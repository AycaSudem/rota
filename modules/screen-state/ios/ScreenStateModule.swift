import ExpoModulesCore
import UIKit

/// Cihaz kilitlendiğinde (şifre açıksa) iOS "korumalı veri kapanıyor" bildirimi yollar.
/// Bu anı kaydedip Rota'nın "ekranı kilitledi" ile "başka uygulamaya geçti"yi ayırmasını sağlarız.
public final class ScreenStateModule: Module {
  static var lastLockAt: Double = 0
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ScreenState")

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: UIApplication.protectedDataWillBecomeUnavailableNotification,
        object: nil,
        queue: .main
      ) { _ in
        ScreenStateModule.lastLockAt = Date().timeIntervalSince1970 * 1000
      }
    }

    OnDestroy {
      if let o = self.observer {
        NotificationCenter.default.removeObserver(o)
      }
    }

    Function("lastScreenOffAt") { () -> Double in
      return ScreenStateModule.lastLockAt
    }

    Function("isScreenOn") { () -> Bool in
      return true
    }
  }
}
