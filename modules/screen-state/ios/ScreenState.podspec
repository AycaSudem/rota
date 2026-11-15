Pod::Spec.new do |s|
  s.name           = 'ScreenState'
  s.version        = '1.0.0'
  s.summary        = 'Ekran kilidi algılama'
  s.description    = 'Rota: ekran kilitlendi mi, yoksa başka uygulamaya mı geçildi?'
  s.license        = { :type => "Proprietary", :text => "Copyright (c) 2026 AycaSudem. All rights reserved." }
  s.author         = 'Rota'
  s.homepage       = 'https://expo.dev'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
