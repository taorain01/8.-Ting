const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mainActivityPath = path.join(
  root,
  'android',
  'app',
  'src',
  'main',
  'java',
  'app',
  'ting',
  'manager',
  'MainActivity.java'
);

if (!fs.existsSync(mainActivityPath)) {
  console.warn('Android MainActivity not found. Skipping back button patch.');
  process.exit(0);
}

let source = fs.readFileSync(mainActivityPath, 'utf8');

if (!source.includes('import androidx.activity.OnBackPressedCallback;')) {
  source = source.replace(
    /import android\.os\.Bundle;\r?\n/,
    'import android.os.Bundle;\n\nimport androidx.activity.OnBackPressedCallback;\n'
  );
}

if (!source.includes('private static final String BACK_BUTTON_SCRIPT')) {
  source = source.replace(
    /public class MainActivity extends BridgeActivity \{\r?\n/,
    `public class MainActivity extends BridgeActivity {
    private static final String BACK_BUTTON_SCRIPT =
        "(function(){try{if(typeof window.handleTingAndroidBackButton==='function')" +
        "{return window.handleTingAndroidBackButton();}return 'handled';}" +
        "catch(error){console.error('Ting back button error:', error);return 'handled';}})();";

`
  );
}

if (!source.includes('getOnBackPressedDispatcher().addCallback')) {
  source = source.replace(
    /        super\.onCreate\(savedInstanceState\);\r?\n/,
    `        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleAndroidBackButton();
            }
        });
`
  );
}

if (!source.includes('private void handleAndroidBackButton()')) {
  source = source.replace(
    /\n}\s*$/,
    `

    private void handleAndroidBackButton() {
        if (bridge == null || bridge.getWebView() == null) {
            finish();
            return;
        }

        bridge.eval(BACK_BUTTON_SCRIPT, result -> {
            if (result != null && result.contains("exit")) {
                runOnUiThread(this::finish);
            }
        });
    }
}
`
  );
}

fs.writeFileSync(mainActivityPath, source);
console.log('Patched Android back button handler.');
