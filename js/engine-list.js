let allEngines = [];

// Load the data
fetch('js/engines.json')
    .then(response => response.json())
    .then(data => {
        allEngines = data;
        renderEngines(allEngines); // Initial render
    })
    .catch(err => console.error("Error loading engines:", err));

const grid = document.getElementById('engine-grid');
const searchInput = document.getElementById('engine-search');
const countLabel = document.getElementById('result-count');

// Search Logic
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    
    const filtered = allEngines.filter(eng => {
        // Search in Name, Author, Language, or Protocol
        return (eng.name && eng.name.toLowerCase().includes(term)) ||
               (eng.author && eng.author.toLowerCase().includes(term)) ||
               (eng.tech.lang && eng.tech.lang.toLowerCase().includes(term)) ||
               (eng.tech.protocol && eng.tech.protocol.toLowerCase().includes(term));
    });

    renderEngines(filtered);
});

function renderEngines(list) {
    grid.innerHTML = '';
    
    // Performance: If list is massive, only render first 50 until searched
    const displayList = list.slice(0, 100); 

    if(list.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:#666;">No engines found.</p>';
        return;
    }

    countLabel.textContent = `Showing ${displayList.length} of ${allEngines.length} engines`;

    displayList.forEach(eng => {
        const card = document.createElement('div');
        card.className = 'engine-card';
        card.onclick = () => openModal(eng);

        // Fallback for null values
        const country = eng.country || '???';
        const rating = eng.rating || '-';
        const lang = eng.tech.lang || 'Unknown';

        card.innerHTML = `
            <div class="engine-header">
                <span class="engine-name">${eng.name}</span>
                <span class="engine-rating">${rating}</span>
            </div>
            <div class="engine-meta">Code: ${country}</div>
            <div class="engine-meta">Lang: ${lang}</div>
            <div class="engine-meta">Proto: ${eng.tech.protocol || '-'}</div>
        `;
        grid.appendChild(card);
    });
}

// Modal Logic
const modal = document.getElementById('modal');

function openModal(eng) {
    document.getElementById('m-name').textContent = eng.name;
    document.getElementById('m-author').textContent = `by ${eng.author || 'Unknown'} (${eng.country || '-'})`;
    
    const d = document.getElementById('m-details');
    d.innerHTML = `
        ${row('Protocol', eng.tech.protocol)}
        ${row('Language', eng.tech.lang)}
        ${row('Open Source', eng.tech.source)}
        ${row('NN / NNUE', eng.tech.nn)}
        ${row('Endgame Tables', eng.tech.tables)}
        ${row('Last Update', eng.release.date || eng.release.last)}
        ${row('Notes', eng.notes ? eng.notes : 'None')}
    `;

    const linkBtn = document.getElementById('m-link');
    if(eng.links) {
        linkBtn.href = eng.links;
        linkBtn.style.display = 'inline-block';
    } else {
        linkBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
}

function row(label, value) {
    if(!value || value === '-') return '';
    return `
        <div class="detail-row">
            <span class="detail-label">${label}</span>
            <span class="detail-val">${value}</span>
        </div>
    `;
}

function closeModal() {
    modal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}