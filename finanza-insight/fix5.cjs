const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const regexUseFirestore = /\s*const \{\s*isSyncing,\s*lastSyncedTime,\s*pushToFirestore,\s*isLocalMode\s*\} = useFirestore\([\s\S]*?\);/g;
app = app.replace(regexUseFirestore, '');

const insertStr = `
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

app = app.replace(/(  \/\/ File Upload Logic)/, insertStr + "\n$1");

app = app.replace(/const speechTimeoutRef = useRef<NodeJS\.Timeout \| null>\(null\);/g, '');
app = app.replace(/if \(speechTimeoutRef\.current\) \{[\s\S]*?\}/g, '');
app = app.replace(/speechTimeoutRef\.current = .*?;/g, '');
app = app.replace(/clearTimeout\(speechTimeoutRef\.current\);/g, '');
app = app.replace(/setLastSyncedTime\(Date\.now\(\)\);/g, '');

fs.writeFileSync('src/App.tsx', app);
