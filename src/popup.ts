document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('menuTurnOnOff').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'TurnOnOff' });
        window.close();
    });
    document.getElementById('menuDeduplicate').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'Deduplicate' });
        window.close();
    });

    const textarea = document.getElementById('exclusionRegexes') as HTMLTextAreaElement;
    const saveButton = document.getElementById('saveRegexes');
    const status = document.getElementById('status');

    // Load saved regexes
    chrome.storage.local.get(['exclusionRegexes'], (result) => {
        if (result.exclusionRegexes && Array.isArray(result.exclusionRegexes)) {
            textarea.value = result.exclusionRegexes.join('\n');
        }
    });

    // Save regexes
    saveButton.addEventListener('click', () => {
        const lines = textarea.value.split('\n').filter(line => line.trim() !== '');
        // Validate regexes
        try {
            lines.forEach(line => new RegExp(line));
            chrome.storage.local.set({ exclusionRegexes: lines }, () => {
                status.textContent = 'Saved!';
                setTimeout(() => { status.textContent = ''; }, 2000);
            });
        } catch (e) {
            status.textContent = 'Invalid Regex: ' + e.message;
            status.style.color = 'red';
            setTimeout(() => {
                status.textContent = '';
                status.style.color = 'green';
            }, 3000);
        }
    });
});
