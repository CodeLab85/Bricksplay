
// 1. FIREBASE IMPORTE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQmIWAm9S-0FfBaJgWNGbS4i5Hl72TfKA",
  authDomain: "bricksplaylagertool.firebaseapp.com",
  projectId: "bricksplaylagertool",
  storageBucket: "bricksplaylagertool.firebasestorage.app",
  messagingSenderId: "771269482314",
  appId: "1:771269482314:web:578f947d14725e38bfd3b3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const sections = {
    login: document.getElementById('login-section'),
    dashboard: document.getElementById('dashboard-section'),
    scanner: document.getElementById('scanner-section'),
    action: document.getElementById('product-action-section'),
    history: document.getElementById('history-section')
};
const nav = document.getElementById('main-nav');
let qrScanner = null;
let currentLoadedStock = 0; 
let allInventoryData = []; 

function showSection(sectionName) {
    Object.values(sections).forEach(sec => sec.classList.remove('active'));
    sections[sectionName].classList.add('active');
    
    if(sectionName !== 'login') {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }

    if(sectionName === 'dashboard') loadDashboardData();
    if(sectionName === 'history') loadHistoryData();
}

// 4. AUTH & NAVIGATION
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        document.getElementById('login-error').classList.add('hidden');
    } catch (error) {
        document.getElementById('login-error').innerText = "Login fehlgeschlagen.";
        document.getElementById('login-error').classList.remove('hidden');
    }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));
onAuthStateChanged(auth, (user) => { if (user) showSection('dashboard'); else showSection('login'); });

document.getElementById('btn-dashboard').addEventListener('click', () => { stopScanner(); showSection('dashboard'); });
document.getElementById('btn-close-action').addEventListener('click', () => showSection('dashboard'));
document.getElementById('btn-scan').addEventListener('click', startScanner);
document.getElementById('btn-cancel-scan').addEventListener('click', () => { stopScanner(); showSection('dashboard'); });
document.getElementById('btn-history').addEventListener('click', () => { stopScanner(); showSection('history'); });

// DYNAMIC FIELDS TOGGLE
document.getElementById('action-type').addEventListener('change', (e) => {
    if(e.target.value === 'produkt') {
        document.getElementById('fields-produkt').classList.remove('hidden');
        document.getElementById('fields-material').classList.add('hidden');
    } else {
        document.getElementById('fields-produkt').classList.add('hidden');
        document.getElementById('fields-material').classList.remove('hidden');
    }
});

function cleanSku(rawText) {
    if (!rawText) return "";
    let trimmed = rawText.trim();
    if (trimmed.includes('/')) {
        let parts = trimmed.split('/');
        trimmed = parts[parts.length - 1];
    }
    return trimmed;
}

// SCANNER (Nimiq)
function startScanner() {
    showSection('scanner');
    const videoElem = document.getElementById('qr-video');
    if (!qrScanner) {
        qrScanner = new QrScanner(videoElem, result => {
            stopScanner(); 
            const cleanCode = cleanSku(result.data);
            openProductAction(cleanCode);
        }, { highlightScanRegion: true, highlightCodeOutline: true });
    }
    qrScanner.start().catch(err => alert("Kamerafehler."));
}
function stopScanner() { if (qrScanner) qrScanner.stop(); }

// DASHBOARD & SUCHE
async function loadDashboardData() {
    const prodList = document.getElementById('product-list');
    const matList = document.getElementById('material-list');
    prodList.innerHTML = '<p>Lade...</p>'; matList.innerHTML = '<p>Lade...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allInventoryData = [];
        querySnapshot.forEach((doc) => {
            allInventoryData.push({ id: doc.id, ...doc.data() });
        });
        renderDashboard(allInventoryData);
    } catch (error) {
        console.error(error);
    }
}

function renderDashboard(dataArray) {
    const prodList = document.getElementById('product-list');
    const matList = document.getElementById('material-list');
    let htmlProd = ''; let htmlMat = '';

    dataArray.forEach((data) => {
        const itemType = data.type || 'produkt';
        const imgHtml = data.image ? `<img src="${data.image}" class="item-image" onerror="this.style.display='none'">` : '';
        const name = data.name || 'Unbenannt';
        const asinStr = data.asin ? `<br><small style="color:#aaa;">ASIN: ${data.asin}</small>` : '';
        
        const cardHtml = `
            <div class="item-card">
                ${itemType === 'produkt' ? imgHtml : ''}
                <div class="item-details">
                    <h3 style="margin-bottom: 5px; color: var(--bp-yellow);">${name}</h3>
                    <div style="font-size: 0.9rem;">
                        <strong>SKU:</strong> ${data.id} ${asinStr}<br>
                        <strong>Platz:</strong> ${data.location || '-'}
                    </div>
                    <div style="margin-top: 8px; font-size: 1.1rem;">
                        Bestand: <strong style="font-size: 1.3rem; color: ${data.stock > 0 ? '#4CAF50' : '#F44336'};">${data.stock || 0}</strong>
                    </div>
                    <button onclick="window.openProductAction('${data.id}')" style="margin-top: 10px; padding: 5px;" class="secondary">Bearbeiten</button>
                </div>
            </div>
        `;
        if (itemType === 'material') htmlMat += cardHtml; else htmlProd += cardHtml;
    });

    prodList.innerHTML = htmlProd !== '' ? htmlProd : '<p>Keine Produkte gefunden.</p>';
    matList.innerHTML = htmlMat !== '' ? htmlMat : '<p>Kein Material gefunden.</p>';
}

document.getElementById('search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allInventoryData.filter(item => {
        return (item.name && item.name.toLowerCase().includes(term)) || 
               (item.id && item.id.toLowerCase().includes(term)) ||
               (item.asin && item.asin.toLowerCase().includes(term)) ||
               (item.location && item.location.toLowerCase().includes(term));
    });
    renderDashboard(filtered);
});

window.openProductAction = async function(sku) {
    const cleanedSku = cleanSku(sku); 
    document.getElementById('action-sku').innerText = cleanedSku;
    document.getElementById('inventur-mode').checked = false; 
    showSection('action');

    try {
        const docRef = doc(db, "products", cleanedSku);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('action-type').value = data.type || 'produkt';
            document.getElementById('action-type').dispatchEvent(new Event('change')); 
            
            document.getElementById('prod-image').value = data.image || '';
            document.getElementById('prod-asin').value = data.asin || '';
            document.getElementById('prod-name').value = data.name || '';
            document.getElementById('prod-subtype').value = data.subType || '';
            document.getElementById('prod-variant').value = data.variant || '';
            document.getElementById('prod-location').value = data.location || '';
            
            document.getElementById('mat-name').value = data.name || '';
            document.getElementById('mat-subtype').value = data.subType || '';
            document.getElementById('mat-location').value = data.location || '';
            
            currentLoadedStock = data.stock || 0;
            document.getElementById('action-stock').value = currentLoadedStock;
        } else {
            document.getElementById('action-type').value = 'produkt';
            document.getElementById('action-type').dispatchEvent(new Event('change'));
            document.querySelectorAll('#product-action-section input[type="text"]').forEach(i => i.value = '');
            document.getElementById('prod-subtype').value = '';
            currentLoadedStock = 0;
            document.getElementById('action-stock').value = 0;
        }
    } catch (error) {}
}

const stockInput = document.getElementById('action-stock');
document.getElementById('btn-increase').addEventListener('click', () => stockInput.value = parseInt(stockInput.value || 0) + 1);
document.getElementById('btn-decrease').addEventListener('click', () => stockInput.value = parseInt(stockInput.value || 0) - 1);

document.getElementById('btn-save-product').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-product');
    btn.innerText = "Speichert..."; btn.disabled = true;

    const sku = cleanSku(document.getElementById('action-sku').innerText);
    const type = document.getElementById('action-type').value;
    const isInventur = document.getElementById('inventur-mode').checked;
    const inputStock = parseInt(stockInput.value || 0);
    
    let saveData = { type: type, updatedAt: new Date().toISOString() };
    let nameForLog = "";

    if (type === 'produkt') {
        saveData.image = document.getElementById('prod-image').value;
        saveData.asin = document.getElementById('prod-asin').value;
        saveData.name = document.getElementById('prod-name').value;
        saveData.subType = document.getElementById('prod-subtype').value;
        saveData.variant = document.getElementById('prod-variant').value;
        saveData.location = document.getElementById('prod-location').value;
        nameForLog = saveData.name;
    } else {
        saveData.name = document.getElementById('mat-name').value;
        saveData.subType = document.getElementById('mat-subtype').value;
        saveData.location = document.getElementById('mat-location').value;
        nameForLog = saveData.name;
    }

    try {
        const docRef = doc(db, "products", sku);
        const docSnap = await getDoc(docRef);
        let absoluteDBStock = 0;
        if (docSnap.exists()) absoluteDBStock = docSnap.data().stock || 0;

        let finalNewStock = 0;
        if (isInventur) {
            finalNewStock = inputStock;
        } else {
            const delta = inputStock - currentLoadedStock;
            finalNewStock = absoluteDBStock + delta;
        }
        
        saveData.stock = finalNewStock;

        await setDoc(docRef, saveData, { merge: true }); 

        if (auth.currentUser) {
            await addDoc(collection(db, "history"), {
                sku: sku, name: nameForLog, type: type,
                oldStock: absoluteDBStock, newStock: finalNewStock, 
                isInventurMode: isInventur,
                user: auth.currentUser.email, timestamp: new Date().toISOString()
            });
        }
        showSection('dashboard');
    } catch (error) {
        alert("Fehler: " + error.message);
    } finally {
        btn.innerText = "Buchen & Speichern"; btn.disabled = false;
    }
});

// LOGBUCH & EXPORT
async function loadHistoryData() {
    const histList = document.getElementById('history-list');
    histList.innerHTML = 'Lade...';
    try {
        const q = query(collection(db, "history"), orderBy("timestamp", "desc"), limit(20));
        const querySnapshot = await getDocs(q);
        let html = '';
        querySnapshot.forEach((doc) => {
            const d = doc.data();
            const date = new Date(d.timestamp).toLocaleString('de-DE');
            html += `<div class="history-item">
                <strong style="color:var(--bp-yellow)">${d.name || d.sku}</strong> <br>
                Neu: ${d.newStock} (Alt: ${d.oldStock}) ${d.isInventurMode ? '[INVENTUR]' : ''} <br>
                <small>${date} | ${d.user}</small>
            </div>`;
        });
        histList.innerHTML = html !== '' ? html : 'Keine Historie gefunden.';
    } catch (e) { console.error(e); }
}

// 1. LAGERBESTAND ALS CSV EXPORTIEREN
document.getElementById('btn-export-inventory').addEventListener('click', async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        // CSV Header: SKU,Typ,Name,ASIN,SubTyp,Variante,Lagerplatz,Bestand,BildURL
        let csvContent = "data:text/csv;charset=utf-8,SKU,Typ,Name,ASIN,SubTyp,Variante,Lagerplatz,Bestand,BildURL\n";
        
        querySnapshot.forEach((doc) => {
            const d = doc.data();
            const row = [
                doc.id,
                d.type || 'produkt',
                `"${d.name || ''}"`,
                `"${d.asin || ''}"`,
                `"${d.subType || ''}"`,
                `"${d.variant || ''}"`,
                `"${d.location || ''}"`,
                d.stock || 0,
                `"${d.image || ''}"`
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "bricksplay_lagerbestand.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        alert("Fehler beim Exportieren des Lagerbestands.");
    }
});

// 2. CSV IMPORTIEREN (ANLEGEN & AKTUALISIEREN)
document.getElementById('btn-import-csv').addEventListener('click', async () => {
    const fileInput = document.getElementById('csv-file-input');
    if (!fileInput.files.length) {
        alert("Bitte zuerst eine CSV-Datei auswählen!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split("\n");
        
        if (lines.length < 2) {
            alert("Die CSV-Datei ist leer oder hat das falsche Format.");
            return;
        }

        let importedCount = 0;
        const btn = document.getElementById('btn-import-csv');
        btn.innerText = "Importiere...";
        btn.disabled = true;

        try {
            // Überspringe Zeile 0 (Header)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Einfacher CSV Parser (berücksichtigt Anführungszeichen)
                const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
                const cols = line.split(regex).map(val => val.replace(/^"|"$/g, '').trim());

                // Spalten: SKU(0), Typ(1), Name(2), ASIN(3), SubTyp(4), Variante(5), Lagerplatz(6), Bestand(7), BildURL(8)
                const sku = cols[0];
                if (!sku) continue;

                const itemData = {
                    type: cols[1] || 'produkt',
                    name: cols[2] || '',
                    asin: cols[3] || '',
                    subType: cols[4] || '',
                    variant: cols[5] || '',
                    location: cols[6] || '',
                    stock: parseInt(cols[7] || 0),
                    image: cols[8] || '',
                    updatedAt: new Date().toISOString()
                };

                // In Firestore speichern (überschreibt bestehende SKUs oder legt sie neu an)
                await setDoc(doc(db, "products", sku), itemData, { merge: true });
                importedCount++;
            }

            alert(`Erfolgreich ${importedCount} Artikel importiert / aktualisiert!`);
            fileInput.value = "";
            loadDashboardData();
        } catch (error) {
            alert("Import-Fehler: " + error.message);
        } finally {
            btn.innerText = "📤 CSV-Datei hochladen & importieren";
            btn.disabled = false;
        }
    };

    reader.readAsText(file);
});

// HISTORIE EXPORT
document.getElementById('btn-export-history').addEventListener('click', async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "history"));
        let csvContent = "data:text/csv;charset=utf-8,Datum,User,SKU,Name,Typ,Alt-Bestand,Neu-Bestand,InventurModus\n";
        querySnapshot.forEach((doc) => {
            const d = doc.data();
            const row = [d.timestamp, d.user, d.sku, `"${d.name || ''}"`, d.type, d.oldStock, d.newStock, d.isInventurMode ? 'JA' : 'NEIN'].join(",");
            csvContent += row + "\n";
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "bricksplay_logbuch.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        alert("Fehler beim Exportieren.");
    }
});
