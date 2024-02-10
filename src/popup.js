const newNoteButton = document.getElementById('new-note-button');
const savedNotesButton = document.getElementById('saved-notes-button');
const modalContainer = document.getElementById('modal-container');
const saveButton = document.getElementById('save-button');
const closeButton = document.getElementById('modal-close-button');
const savedNotesList = document.getElementById('saved-notes-list');

function generateUniqueId() {
    return crypto.randomUUID();
}

newNoteButton.addEventListener('click', () => {
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
});

saveButton.addEventListener('click', () => {
    const title = document.getElementById('note-title').value;
    const content = document.getElementById('note-content').value;
    const date = new Date().toLocaleString();

    if (!title || !content) {
        alert('Please enter a title and content.');
        return;
    }

    const note = { title, content, date, id: generateUniqueId() };

    chrome.storage.sync.get('notes', (data) => {
        let notes = data.notes || [];

        if (editingNoteId) {
            // If editingNoteId is set, it means we're editing an existing note
            const index = notes.findIndex((savedNote) => savedNote.id === editingNoteId);
            if (index !== -1) {
                // Update existing note
                notes[index].title = title;
                notes[index].content = content;
                notes[index].date = date;
            }
        } else {
            // If editingNoteId is not set, it means we're creating a new note
            note.id = generateUniqueId();
            notes.push(note);
        }

        chrome.storage.sync.set({ notes }, () => {
            console.log('Note saved successfully');
            displaySavedNotes(); // Update list after saving
        });
    });

    // Clear input fields
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
});

function saveNote(note) {
    chrome.storage.sync.get('notes', (data) => {
        const notes = data.notes || [];
        notes.push(note);
        chrome.storage.sync.set({ notes }, () => {
            console.log('Note saved successfully');
            displaySavedNotes();
        });
    });
}

let editingNoteId; // Variable to store the ID of the note being edited

savedNotesButton.addEventListener('click', () => {
    editingNoteId = null; // Reset editingNoteId when opening the modal
    displaySavedNotes();
    modalContainer.classList.add('visible');
});

function displaySavedNotes() {
    chrome.storage.sync.get('notes', (data) => {
        const notes = data.notes || [];
        savedNotesList.innerHTML = ''; // clear previous notes

        if (notes.length === 0) {
            // No notes saved, display a message
            const noNotesMessage = document.createElement('p');
            noNotesMessage.textContent = 'No notes saved yet. Start making your notes!';
            savedNotesList.appendChild(noNotesMessage);

            // Hide the "Delete All Notes" and "Export Notes" buttons
            document.getElementById('delete-all-notes-button').style.display = 'none';
            document.getElementById('export-button').style.display = 'none';
        } else {
            // Reverse the order of notes to display newest notes first
            const reversedNotes = notes.slice().reverse();

            // Display saved notes
            reversedNotes.forEach((note) => {
                const listItem = document.createElement('li');
                const noteTitle = document.createElement('b');
                const noteDate = document.createElement('span');
                const deleteButton = document.createElement('button');

                noteTitle.textContent = note.title;
                noteDate.textContent = ` - ${note.date}`;
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('hidden'); // Initially hidden

                listItem.appendChild(noteTitle);
                listItem.appendChild(noteDate);
                listItem.appendChild(deleteButton);

                // Add click listener to note for opening/closing modal
                listItem.addEventListener('click', () => {
                    loadNote(note);
                    modalContainer.classList.remove('visible'); // Close modal
                });

                // Add hover and delete functionality
                listItem.addEventListener('mouseover', () => {
                    deleteButton.classList.remove('hidden');
                });
                listItem.addEventListener('mouseout', () => {
                    deleteButton.classList.add('hidden');
                });

                deleteButton.addEventListener('click', () => {
                    showConfirmDialog(note.title, () => {
                        chrome.storage.sync.get('notes', (data) => {
                            const notes = data.notes || [];
                            const newNotes = notes.filter((savedNote) => savedNote.id !== note.id);
                            chrome.storage.sync.set({ notes: newNotes }, () => {
                                // Update the savedNotesList after deletion
                                displaySavedNotes();

                                // Don't load the deleted note's content, clear input fields instead
                                document.getElementById('note-title').value = '';
                                document.getElementById('note-content').value = '';
                            });
                        });
                    });
                });

                savedNotesList.appendChild(listItem);
            });

            // Show the "Delete All Notes" and "Export Notes" buttons
            document.getElementById('delete-all-notes-button').style.display = 'block';
            document.getElementById('export-button').style.display = 'block';
        }
    });
}

function showConfirmDialog(noteTitle, onConfirm) {
    if (confirm(`Are you sure you want to delete the note "${noteTitle}"?`)) {
        onConfirm();
    }
}

function loadNote(note) {
    editingNoteId = note.id; // Store the ID of the note being edited
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
    modalContainer.classList.remove('visible');
}

document.getElementById('export-button').addEventListener('click', exportNotes);
document.getElementById('import-file').addEventListener('change', handleImport);

function exportNotes() {
    chrome.storage.sync.get('notes', (data) => {
        const notes = data.notes || [];

        if (notes.length === 0) {
            alert('No notes to export.');
            return;
        }

        // Prepare notes for export
        const exportData = notes.map((note) => ({
            title: note.title,
            date: note.date,
            id: note.id,
            content: btoa(unescape(encodeURIComponent(note.content))), // Encode UTF-8 content to base64
        }));

        // Create JSON string
        const jsonString = JSON.stringify(exportData, null, 2);

        // Create blob and download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes.json';
        a.click();

        // Revoke URL
        URL.revokeObjectURL(url);
    });
}

document.getElementById('import-button').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('No file selected.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const importedJson = event.target.result;
        try {
            const importedNotes = JSON.parse(importedJson);
            // Validate importedNotes format if needed
            decodeImportedNotes(importedNotes);
        } catch (error) {
            alert('Error parsing JSON file.');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

function decodeImportedNotes(importedNotes) {
    // Decode base64-encoded content of imported notes
    const decodedNotes = importedNotes.map((note) => ({
        ...note,
        content: decodeURIComponent(escape(atob(note.content))),
    }));

    // Save decoded notes to Chrome storage
    chrome.storage.sync.set({ notes: decodedNotes }, () => {
        console.log('Notes imported successfully');
        displaySavedNotes(); // Update list after importing notes
    });
}

// Add event listener to the "Delete All Notes" button
document.getElementById('delete-all-notes-button').addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all notes?')) {
        chrome.storage.sync.remove('notes', () => {
            console.log('All notes deleted successfully');
            displaySavedNotes(); // Update list after deleting all notes
        });
    }
});

// Close modal on clicking outside or "X" button
modalContainer.addEventListener('click', (event) => {
    if (event.target === modalContainer || event.target === closeButton) {
        modalContainer.classList.remove('visible');
    }
});

closeButton.addEventListener('click', () => {
    modalContainer.classList.remove('visible');
});