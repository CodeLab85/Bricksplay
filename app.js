
// 1. FIREBASE IMPORTE (Direkt via CDN für GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

function showSection(sectionName) {
    Object.values(sections).forEach(sec => sec.classList.remove('active'));
    sections[sectionName].classList.add('active');
    
    if(sectionName !== 'login') {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }
}

// 4. AUTHENTIFIZIERUNG (Login/Logout)
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
        console.error("Login Fehler:", error);
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});

// Listener: Prüft ob User eingeloggt ist oder nicht
onAuthStateChanged(auth, (user) => {
    if (user) {
        showSection('dashboard');
    } else {
        showSection('login');
    }
});


// 5. NAVIGATION & SCANNER LOGIK
document.getElementById('btn-dashboard').addEventListener('click', () => { stopScanner(); showSection('dashboard'); });
document.getElementById('btn-close-action').addEventListener('click', () => { showSection('dashboard'); });
document.getElementById('btn-scan').addEventListener('click', () => { showSection('scanner'); startScanner(); });
document.getElementById('btn-cancel-scan').addEventListener('click', () => { stopScanner(); showSection('dashboard'); });

function startScanner() {
    if (!html5QrcodeScanner) html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            stopScanner();
            openProductAction(decodedText);
        },
        (errorMessage) => {}
    ).catch(err => { alert("Kamerafehler. Bitte erlaube den Kamerazugriff im Browser."); });
}

function stopScanner() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(console.error);
    }
}

// 6. PRODUKT LADEN (Firestore)
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
            // Neues Produkt, Felder leeren
            document.getElementById('action-name').value = '';
            document.getElementById('action-location').value = '';
            document.getElementById('action-variants').value = '';
            document.getElementById('action-stock').value = 0;
        }
    } catch (error) {
        console.error("Fehler beim Abrufen der Daten:", error);
        alert("Datenbank-Fehler. Bist du eingeloggt?");
    }
}

// Mengen-Steuerung
const stockInput = document.getElementById('action-stock');
document.getElementById('btn-increase').addEventListener('click', () => {
    stockInput.value = parseInt(stockInput.value || 0) + 1;
});
document.getElementById('btn-decrease').addEventListener('click', () => {
    stockInput.value = parseInt(stockInput.value || 0) - 1; 
});

// 7. PRODUKT SPEICHERN (Firestore)
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
        // 1. Produkt-Datenbank aktualisieren
        await setDoc(doc(db, "products", sku), {
            name: name,
            location: location,
            variants: variants,
            stock: stock,
            updatedAt: new Date().toISOString()
        }, { merge: true }); // merge: true sorgt dafür, dass vorhandene Daten nicht überschrieben werden, wenn sie im UI fehlen

        // 2. Historien-Eintrag (Logbuch) anlegen
        if (auth.currentUser) {
            await addDoc(collection(db, "history"), {
                sku: sku,
                name: name,
                newStock: stock,
                user: auth.currentUser.email,
                timestamp: new Date().toISOString()
            });
        }

        alert("Bestand erfolgreich gebucht!");
        showSection('dashboard');
    } catch (error) {
        console.error("Speicher-Fehler:", error);
        alert("Fehler beim Speichern: " + error.message);
    } finally {
        btn.innerText = "Buchen & Speichern";
        btn.disabled = false;
    }
});
