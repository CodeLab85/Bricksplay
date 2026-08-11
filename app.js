
// 1. FIREBASE IMPORTE (Direkt via CDN für GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 2. DEINE FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCQmIWAm9S-0FfBaJgWNGbS4i5Hl72TfKA",
  authDomain: "bricksplaylagertool.firebaseapp.com",
  projectId: "bricksplaylagertool",
  storageBucket: "bricksplaylagertool.firebasestorage.app",
  messagingSenderId: "771269482314",
  appId: "1:771269482314:web:578f947d14725e38bfd3b3"
};

// 3. FIREBASE INITIALISIEREN
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UI Elemente referenzieren
const sections = {
    login: document.getElementById('login-section'),
    dashboard: document.getElementById('dashboard-section'),
    scanner: document.getElementById('scanner-section'),
    action: document.getElementById('product-action-section')
};
const nav = document.getElementById('main-nav');
let html5QrcodeScanner = null;
let isScanning = false;

function showSection(sectionName) {
    Object.values(sections).forEach(sec => sec.classList.remove('active'));
    sections[sectionName].classList.add('active');
    
    if(sectionName !== 'login') {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }

    if(sectionName === 'dashboard') {
        loadDashboardData();
    }
}

// 4. AUTHENTIFIZIERUNG
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        errorMsg.classList.add('hidden');
    } catch (error) {
        errorMsg.innerText = "Login fehlgeschlagen. E-Mail oder Passwort falsch.";
        errorMsg.classList.remove('hidden');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) showSection('dashboard');
    else showSection('login');
});

// 5. NAVIGATION & SCANNER LOGIK (GEFIXTE VIDEO ANSICHT)
document.getElementById('btn-dashboard').addEventListener('click', () => { stopScanner(); showSection('dashboard'); });
document.getElementById('btn-close-action').addEventListener('click', () => { showSection('dashboard'); });
document.getElementById('btn-scan').addEventListener('click', () => { showSection('scanner'); startScanner(); });
document.getElementById('btn-cancel-scan').addEventListener('click', () => { stopScanner(); showSection('dashboard'); });

function startScanner() {
    if (isScanning) return;
    
    const readerDiv = document.getElementById('reader');
    readerDiv.innerHTML = "<h3 style='color:black; padding: 30px; text-align: center;'>Kamera wird gestartet... Bild erscheint gleich.</h3>";
    
    // WICHTIG: Wir warten 400 Millisekunden, bevor wir die Kamera starten.
    // Warum? Die CSS-Animation zum Einblenden der Section dauert 300ms.
    // Wenn die Bibliothek die Kamera startet, während die Box noch unsichtbar ist, 
    // berechnet sie Breite/Höhe als 0 Pixel und das Video bleibt schwarz oder stürzt ab.
    setTimeout(() => {
        if (!html5QrcodeScanner) {
            html5QrcodeScanner = new Html5Qrcode("reader");
        }
        
        html5QrcodeScanner.start(
            { facingMode: "environment" },
            { 
                fps: 15,
                // Dynamische Scan-Box, die sich an die Handydisplay-Breite anpasst
                qrbox: function(viewfinderWidth, viewfinderHeight) {
                    let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                    let qrboxSize = Math.floor(minEdgeSize * 0.75); // 75% der verfügbaren Breite
                    return { width: qrboxSize, height: qrboxSize };
                }
            },
            (decodedText) => {
                stopScanner();
                openProductAction(decodedText);
            },
            (errorMessage) => {
                // Wird mehrmals pro Sekunde gefeuert, wenn kein Code im Bild ist.
                // Muss ignoriert werden, sonst spamt es die Konsole voll.
            }
        ).then(() => {
            isScanning = true;
        }).catch(err => {
            readerDiv.innerHTML = `<p style="color:red; font-weight:bold; padding:20px;">Kamera-Fehler: ${err}</p>`;
            console.error("Scanner Error: ", err);
        });
    }, 400); 
}

function stopScanner() {
    if (html5QrcodeScanner && isScanning) {
        html5QrcodeScanner.stop().then(() => {
            isScanning = false;
            document.getElementById('reader').innerHTML = ""; // Box leeren
        }).catch(err => console.log("Fehler beim Stoppen", err));
    }
}

// 6. DASHBOARD DATEN LADEN
async function loadDashboardData() {
    const listContainer = document.getElementById('product-list');
    listContainer.innerHTML = '<p>Lade Bestände...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p>Noch keine Produkte im Lager.</p>';
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const sku = doc.id;
            html += `
                <div style="background: var(--bg-card); padding: 15px; margin-bottom: 10px; border-left: 4px solid var(--bp-yellow); border-radius: 4px; text-align: left;">
                    <h3 style="margin-bottom: 5px; color: var(--bp-yellow);">${data.name || 'Unbenannt'}</h3>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                        <span><strong>Art-Nr:</strong> ${sku}</span>
                        <span><strong>Regal:</strong> ${data.location || '-'}</span>
                    </div>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 1.1rem;">
                        <strong>Bestand:</strong> <span style="font-size: 1.3rem; color: ${data.stock > 0 ? '#4CAF50' : '#F44336'};">${data.stock || 0}</span>
                    </div>
                    <button onclick="window.openProductAction('${sku}')" style="margin-top: 10px; padding: 5px;" class="secondary">Bearbeiten</button>
                </div>
            `;
        });
        listContainer.innerHTML = html;
    } catch (error) {
        listContainer.innerHTML = '<p class="error">Fehler beim Laden.</p>';
    }
}

window.openProductAction = openProductAction;

// 7. PRODUKT LADEN
async function openProductAction(sku) {
    document.getElementById('action-sku').innerText = sku;
    showSection('action');

    try {
        const docRef = doc(db, "products", sku);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('action-name').value = data.name || '';
            document.getElementById('action-location').value = data.location || '';
            document.getElementById('action-variants').value = data.variants || '';
            document.getElementById('action-stock').value = data.stock || 0;
        } else {
            document.getElementById('action-name').value = '';
            document.getElementById('action-location').value = '';
            document.getElementById('action-variants').value = '';
            document.getElementById('action-stock').value = 0;
        }
    } catch (error) {}
}

// Mengen-Steuerung
const stockInput = document.getElementById('action-stock');
document.getElementById('btn-increase').addEventListener('click', () => {
    stockInput.value = parseInt(stockInput.value || 0) + 1;
});
document.getElementById('btn-decrease').addEventListener('click', () => {
    stockInput.value = parseInt(stockInput.value || 0) - 1; 
});

// 8. PRODUKT SPEICHERN
document.getElementById('btn-save-product').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-product');
    btn.innerText = "Speichert...";
    btn.disabled = true;

    const sku = document.getElementById('action-sku').innerText;
    const name = document.getElementById('action-name').value;
    const location = document.getElementById('action-location').value;
    const variants = document.getElementById('action-variants').value;
    const stock = parseInt(document.getElementById('action-stock').value || 0);

    try {
        await setDoc(doc(db, "products", sku), {
            name: name, location: location, variants: variants, stock: stock, updatedAt: new Date().toISOString()
        }, { merge: true }); 

        if (auth.currentUser) {
            await addDoc(collection(db, "history"), {
                sku: sku, name: name, newStock: stock, user: auth.currentUser.email, timestamp: new Date().toISOString()
            });
        }
        alert("Bestand erfolgreich gebucht!");
        showSection('dashboard');
    } catch (error) {
        alert("Fehler: " + error.message);
    } finally {
        btn.innerText = "Buchen & Speichern";
        btn.disabled = false;
    }
});
