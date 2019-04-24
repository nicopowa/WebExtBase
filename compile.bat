cls
cd /d %~dp0
java -jar ../_closure/compiler.jar ^
--js ../_closure/goog/base.js ^
--compilation_level ADVANCED_OPTIMIZATIONS ^
--warning_level VERBOSE ^
--language_in STABLE ^
--language_out ES5_STRICT ^
--externs ../_externs/*.js ^
--js resources/base/extbase.js ^
--js resources/base/ports.js ^
--js resources/base/utils.js ^
--js resources/background.js ^
--js resources/extension.js ^
--js resources/web.js ^
--js resources/popup/popup.js ^
--js_output_file resources/extension.min.js