require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "OpenOTA"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = { "OpenOTA Contributors" => "" }
  s.platforms    = { ios: "15.1" }
  s.source       = { git: package["repository"]["url"], tag: "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.exclude_files = "ios/Tests/**/*"
  s.swift_version = "5.9"

  # Kept even though the module is now pure Swift (see OpenOTAModule.swift's header comment for
  # why the original ObjC++ JSI trampoline was dropped): static_framework is still CocoaPods'
  # documented fix for Swift header build-ordering issues in general, and costs nothing to keep as
  # a safeguard if a JSI trampoline is reintroduced later.
  s.static_framework = true

  s.dependency "React-Core"

  # New Architecture / TurboModule codegen wiring — matches the pattern react-native's own
  # `install_modules_dependencies` helper expects for a codegen'd Swift/ObjC++ TurboModule.
  install_modules_dependencies(s)
end
