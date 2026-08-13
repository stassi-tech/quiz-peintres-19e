const $ = (id) => document.getElementById(id);
const state = { questions: [], index: 0, answers: [], imageFiles: new Map() };
const fields = [
  { key: 'artist', label: 'Artiste', input: 'artist-input' },
  { key: 'date', label: 'Date de création', input: 'date-input' },
  { key: 'location', label: 'Lieu de conservation', input: 'location-input' },
  { key: 'title', label: "Titre de l'œuvre", input: 'title-input' }
];

function keyName(value) {
  return String(value || '').trim().toLocaleLowerCase('fr-FR').replace(/œ/g, 'oe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function findColumn(row, names) {
  const keys = Object.keys(row);
  return keys.find((column) => names.includes(keyName(column)));
}
function normaliseRows(rows) {
  return rows.map((row, rowIndex) => {
    const imageKey = findColumn(row, ['image', 'url image', 'image url', 'lien image', 'visuel']);
    const artistKey = findColumn(row, ['artiste', 'nom artiste', 'artist', 'auteur']);
    const dateKey = findColumn(row, ['date de creation', 'date creation', 'date', 'annee', 'année']);
    const locationKey = findColumn(row, ['lieu de conservation', 'lieu', 'conservation', 'musee', 'musée', 'location']);
    const titleKey = findColumn(row, ["titre de l oeuvre", 'titre oeuvre', 'titre', 'title', 'œuvre', 'oeuvre']);
    if (!imageKey || !artistKey || !dateKey || !locationKey || !titleKey) throw new Error("Les cinq en-têtes requis sont : image, artiste, date de création, lieu de conservation, titre de l'œuvre.");
    return { image: String(row[imageKey] || '').trim(), artist: String(row[artistKey] || '').trim(), date: String(row[dateKey] || '').trim(), location: String(row[locationKey] || '').trim(), title: String(row[titleKey] || '').trim(), row: rowIndex + 2 };
  }).filter((question) => question.image || question.artist || question.date || question.location || question.title);
}
function answerFor(index) {
  if (!state.answers[index]) state.answers[index] = { artist: '', date: '', location: '', title: '', checked: false };
  return state.answers[index];
}
function saveInputs() { const answer = answerFor(state.index); fields.forEach(({ key, input }) => answer[key] = $(input).value); }
function isMatch(actual, expected) {
  const answer = keyName(actual); const target = keyName(expected);
  if (!answer || !target) return false;
  if (answer === target) return true;
  // Accepte un élément significatif de la réponse attendue : « Monet » ou « Orsay ».
  return answer.length >= 3 && (target.includes(answer) || answer.includes(target));
}
function correctCount(answer, question) { return fields.reduce((count, field) => count + Number(isMatch(answer[field.key], question[field.key])), 0); }
function totalCorrect() { return state.questions.reduce((total, question, index) => total + (state.answers[index]?.checked ? correctCount(state.answers[index], question) : 0), 0); }
function checkedQuestions() { return state.answers.filter((answer) => answer?.checked).length; }
function imageSource(reference) {
  if (/^(https?:|data:)/i.test(reference)) return reference;
  return state.imageFiles.get(reference) || state.imageFiles.get(reference.toLocaleLowerCase('fr-FR')) || reference;
}
function shuffleQuestions(questions) {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled;
}

function renderQuestion() {
  const question = state.questions[state.index]; const answer = answerFor(state.index);
  $('question-count').textContent = `Question ${state.index + 1} sur ${state.questions.length}`;
  $('progress-bar').style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
  $('score-summary').textContent = `${totalCorrect()} / ${checkedQuestions() * fields.length} point${totalCorrect() > 1 ? 's' : ''}`;
  const image = $('artwork-image'); const message = $('image-message'); const source = imageSource(question.image);
  image.dataset.originalSource = source; image.dataset.proxyTried = 'false'; image.src = source; image.alt = `Œuvre ${state.index + 1}`; message.classList.add('hidden');
  image.onerror = () => {
    if (image.dataset.proxyTried === 'false' && /^https?:/i.test(image.dataset.originalSource)) {
      image.dataset.proxyTried = 'true';
      image.src = `https://images.weserv.nl/?url=${encodeURIComponent(image.dataset.originalSource)}&w=1200`;
      return;
    }
    message.textContent = `L'image n'a pas pu être chargée. Vérifiez le nom de fichier ou l'URL dans la ligne ${question.row} du fichier.`;
    message.classList.remove('hidden');
  };
  fields.forEach(({ key, input }) => { $(input).value = answer[key]; $(input).disabled = answer.checked; });
  $('check-button').classList.toggle('hidden', answer.checked); $('correction').classList.toggle('hidden', !answer.checked);
  if (answer.checked) renderCorrection(answer, question);
  $('previous-button').disabled = state.index === 0;
  $('next-button').textContent = state.index === state.questions.length - 1 ? 'Voir le score' : 'Suivante →';
}
function renderCorrection(answer, question) {
  $('correction-details').innerHTML = fields.map(({ key, label }) => {
    const correct = isMatch(answer[key], question[key]);
    return `<p><strong>${label} :</strong> <span class="answer-result ${correct ? 'correct' : 'incorrect'}">${correct ? '✓ Correct' : '✕ À retenir'}</span><br><span>Réponse attendue : ${escapeHtml(question[key])}</span></p>`;
  }).join('');
}
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
function showResults() {
  saveInputs(); $('quiz-panel').classList.add('hidden'); $('results-panel').classList.remove('hidden');
  const correct = totalCorrect(); const possible = state.questions.length * fields.length; const percent = Math.round((correct / possible) * 100);
  $('final-score').textContent = `${correct} / ${possible} (${percent} %)`;
  $('final-message').textContent = percent === 100 ? 'Parfait ! Toutes les informations sont justes.' : percent >= 70 ? 'Très bon résultat. Revoyez les réponses restantes pour consolider vos repères.' : 'Continuez : la correction est disponible pour chaque œuvre.';
}

$('excel-file').addEventListener('change', async (event) => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (!window.XLSX) throw new Error('Le module de lecture Excel n’a pas été chargé. Vérifiez votre connexion Internet et rechargez la page.');
    const data = await file.arrayBuffer(); const book = XLSX.read(data, { type: 'array' }); const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
    const questions = normaliseRows(rows); if (!questions.length) throw new Error('Aucune question utilisable n’a été trouvée dans le premier onglet.');
    state.questions = shuffleQuestions(questions); state.answers = []; state.index = 0;
    $('welcome-panel').classList.add('hidden'); $('results-panel').classList.add('hidden'); $('quiz-panel').classList.remove('hidden'); renderQuestion();
  } catch (error) { alert(`Import impossible : ${error.message}`); }
  event.target.value = '';
});
$('image-folder').addEventListener('change', (event) => {
  [...event.target.files].forEach((file) => {
    const url = URL.createObjectURL(file);
    state.imageFiles.set(file.name, url);
    state.imageFiles.set(file.name.toLocaleLowerCase('fr-FR'), url);
  });
  if (state.questions.length) renderQuestion();
  event.target.value = '';
});
$('answer-form').addEventListener('submit', (event) => { event.preventDefault(); saveInputs(); answerFor(state.index).checked = true; renderQuestion(); });
$('previous-button').addEventListener('click', () => { saveInputs(); if (state.index > 0) { state.index--; renderQuestion(); } });
$('next-button').addEventListener('click', () => { saveInputs(); if (state.index === state.questions.length - 1) showResults(); else { state.index++; renderQuestion(); } });
$('review-button').addEventListener('click', () => { $('results-panel').classList.add('hidden'); $('quiz-panel').classList.remove('hidden'); state.index = 0; renderQuestion(); });
