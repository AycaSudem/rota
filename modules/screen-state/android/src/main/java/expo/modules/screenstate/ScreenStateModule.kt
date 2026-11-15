package expo.modules.screenstate

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Ekranın en son kapandığı anı kaydeder; Rota bununla "ekranı kapattı" ile "başka uygulamaya geçti"yi ayırır. */
class ScreenStateModule : Module() {
  companion object {
    @Volatile
    var lastOffAt: Long = 0L
  }

  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("ScreenState")

    OnCreate {
      val ctx = appContext.reactContext?.applicationContext
      if (ctx != null) {
        val r = object : BroadcastReceiver() {
          override fun onReceive(c: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_OFF) lastOffAt = System.currentTimeMillis()
          }
        }
        val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
        if (Build.VERSION.SDK_INT >= 33) {
          ctx.registerReceiver(r, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
          ctx.registerReceiver(r, filter)
        }
        receiver = r
      }
    }

    OnDestroy {
      val ctx = appContext.reactContext?.applicationContext
      receiver?.let {
        try {
          ctx?.unregisterReceiver(it)
        } catch (_: Exception) {
        }
      }
      receiver = null
    }

    Function("lastScreenOffAt") {
      lastOffAt.toDouble()
    }

    Function("isScreenOn") {
      val pm = appContext.reactContext?.getSystemService(Context.POWER_SERVICE) as? PowerManager
      pm?.isInteractive ?: true
    }
  }
}
