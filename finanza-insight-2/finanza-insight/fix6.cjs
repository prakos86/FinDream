const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Remove useFirestore from wherever it currently is completely
const useFirestoreRegex = /\s*const \{\s*isSyncing,\s*lastSyncedTime,\s*pushToFirestore,\s*isLocalMode\s*\} = useFirestore\([\s\S]*?\);/g;
app = app.replace(useFirestoreRegex, '');

// The block to insert
const insertBlock = `
  const { isSyncing, lastSyncedTime, pushToFirestore, isLocalMode } = useFirestore(
    showSplash,
    userProfile, setUserProfile,
    transacciones, setTransacciones,
    suenos, setSuenos,
    categorias, setCategorias,
    paymentMethods, setPaymentMethods,
    setNotchAlert,
    selectedLanguage
  );
`;

// Find line 1166 (isImportingSheets, etc) to insert after
app = app.replace(/(const \[recognitionError, setRecognitionError\] = useState<string \| null>\(null\);)/, "$1\n" + insertBlock);

fs.writeFileSync('src/App.tsx', app);
