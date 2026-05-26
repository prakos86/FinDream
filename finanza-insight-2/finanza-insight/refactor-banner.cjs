const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add firebase auth imports at the top
app = app.replace(
  /import \{ auth \} from '\.\/firebase';/g,
  "import { auth } from './firebase';\nimport { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';"
);

// If the import was not there:
if (!app.includes('import { GoogleAuthProvider')) {
    app = app.replace(
      /import React[\s\S]*?;/g,
      "$& \nimport { auth } from './firebase';\nimport { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';"
    );
}

// 2. Add local storage cleanup logic inside App component top level
const migrationLogic = `
  // Local storage migration
  useEffect(() => {
    if (!sessionStorage.getItem('findream_migrated')) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('finanza_') && key !== 'finanza_user_profile_v2' && key !== 'finanza_transacciones_v2' && key !== 'finanza_suenos_v2' && key !== 'finanza_payment_methods_v2' && key !== 'finanza_hide_balances_v2') {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.setItem('findream_migrated', 'true');
    }
  }, []);
`;

app = app.replace(/(const App: React\.FC = \(\) => {)/, "$1" + migrationLogic);

// 3. Add Google Sign in function
const signInFn = `
  const handleBannerSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error('Login error', e);
    }
  };
`;

app = app.replace(/(return \(\s*<div className="h-\[100dvh\] bg-\[#0d0e14\])/, signInFn + "\n  $1");

// 4. Add the banner inside the wrapper
const bannerJSX = `
        {isLocalMode && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 relative z-50 shadow-sm">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 mt-0.5">⚠️</span>
              <p className="text-[11px] text-yellow-800 font-medium leading-snug">
                FinDream está guardando datos localmente en tu dispositivo. <strong className="font-bold">Inicia sesión</strong> para habilitar el guardado automático de la nube.
              </p>
            </div>
            <button
              onClick={handleBannerSignIn}
              className="w-full sm:w-auto px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 active:scale-95 transition-all rounded-lg text-[11px] font-black tracking-wide text-white shadow-sm whitespace-nowrap uppercase cursor-pointer"
            >
              Iniciar sesión Google
            </button>
          </div>
        )}
`;

app = app.replace(/(\{renderAppContent\(\)\})/, bannerJSX + "        $1");

fs.writeFileSync('src/App.tsx', app);
