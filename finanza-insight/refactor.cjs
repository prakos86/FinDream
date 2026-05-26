const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove chat modes
app = app.replace(/\s*\/\/ Chatbot state[\s\S]*?const \[isImmersiveVoiceMode[^;]+;/g, '');

// 2. Remove speechTimeoutRef and recognitionRef
app = app.replace(/\s*const speechTimeoutRef = useRef<NodeJS\.Timeout \| null>\(null\);/g, '');
app = app.replace(/\s*const recognitionRef = useRef<any>\(null\);/g, '');

// 3. Remove popup states
app = app.replace(/\s*\/\/ Bottom Sheet State[\s\S]*?const \[popupFecha[^;]+;/g, '\n  // Bottom Sheet State\n  const [isAddingOpen, setIsAddingOpen] = useState(false);\n  const [popupInitialChoice, setPopupInitialChoice] = useState<\'choice\' | \'form\' | null>(\'choice\');');

// 4. Remove extractNumberFromString
app = app.replace(/\s*const extractNumberFromString[\s\S]*?return total;\n  };/g, '');

// 5. Remove handleGuardarMovimiento
app = app.replace(/\s*\/\/ Handle register transactions[\s\S]*?\n  const handleBorrarTransaccion/g, '\n\n  const handleBorrarTransaccion');

// 6. Remove toggleSpeechRecognition
app = app.replace(/\s*\/\/ Web Speech recognition function[\s\S]*?\n  const toggleChatSpeechRecognition/g, '\n\n  const toggleChatSpeechRecognition');

// 7. Remove toggleChatSpeechRecognition, handleStopVoiceChat, handleSendChatMessage
app = app.replace(/\s*const toggleChatSpeechRecognition[\s\S]*?setIsAIProcessing\(false\);\n    }\n  };/g, '');

// 8. Remove renderMarkdownMsg
app = app.replace(/\s*\/\/ Securely translate bold markings[\s\S]*?return <span key={i}>{part}<\/span>;\n    }\);\n  };/g, '');

// 9. Remove AI Search states
app = app.replace(/\s*\/\/ Custom portfolio AI search states[\s\S]*?const \[isListeningCustomProduct[^;]+;/g, '');

// 10. Replace ChatPanel instance inside App
const chatPanelNew = `              <ChatPanel
                selectedLanguage={selectedLanguage}
                selectedCountry={selectedCountry}
                userProfile={userProfile}
                suenos={suenos}
                activeSuenoId={activeSuenoId}
                totalActivos={totalActivos}
                totalPasivos={totalPasivos}
                transacciones={transacciones}
                saveTransacciones={saveTransacciones}
                saveUserProfileData={saveUserProfileData}
                setSuenos={setSuenos}
                triggerDynamicIsland={triggerDynamicIsland}
                playTone={playTone}
                isMuted={isMuted}
                t={t}
              />`;
app = app.replace(/<ChatPanel\s+chatMessages=\{[^>]+>/g, chatPanelNew);


// 11. Replace TransactionForm instance inside App
const txFormNew = `              <TransactionForm
                onSave={(tx) => {
                  saveTransacciones([
                    { ...tx, id: \`trx-\${Date.now()}\` },
                    ...transacciones
                  ]);
                  setIsAddingOpen(false);
                }}
                onCancel={() => setIsAddingOpen(false)}
                getMergedPaymentMethods={getMergedPaymentMethods}
                CATEGORIAS_PREDEFINIDAS={CATEGORIAS_PREDEFINIDAS}
                categorias={categorias}
                COLOMBIAN_PRODUCTS={COLOMBIAN_PRODUCTS}
                translateProduct={translateProduct}
                selectedLanguage={selectedLanguage}
                renderCategoriaIcon={renderCategoriaIcon}
                triggerDynamicIsland={triggerDynamicIsland}
                playTone={playTone}
                isMuted={isMuted}
                formatLocalYYYYMMDD={formatLocalYYYYMMDD}
              />`;
app = app.replace(/<TransactionForm[\s\S]*?renderCategoriaIcon={renderCategoriaIcon}\s*\/>/g, txFormNew);

// 12. Remove AnimatePresence with immersive voice mode inside return
app = app.replace(/\s*<AnimatePresence>[\s\S]*?\{isImmersiveVoiceMode[\s\S]*?<\/AnimatePresence>/g, '');

fs.writeFileSync('src/App.tsx', app);
