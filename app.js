const $ = (id) => document.getElementById(id);
const state = {
  questions: [],
  answers: [],
  index: 0,
  imageFiles: new Map(),
  selectedFieldKeys: ['artist', 'date', 'location', 'title'],
  mode: 'normal', // 'normal' | 'review'
  fullQuestions: [], // toutes les questions du fichier importé (pour revenir après une révision)
};
const allFields = [
  { key: 'artist', label: 'Artiste', input: 'artist-input', checkbox: 'rubrique-artist', mic: 'mic-artist', kbd: 'kbd-artist' },
  { key: 'date', label: 'Date de création', input: 'date-input', checkbox: 'rubrique-date', mic: 'mic-date', kbd: 'kbd-date' },
  { key: 'location', label: 'Lieu de conservation', input: 'location-input', checkbox: 'rubrique-location', mic: 'mic-location', kbd: 'kbd-location' },
  { key: 'title', label: "Titre de l'œuvre", input: 'title-input', checkbox: 'rubrique-title', mic: 'mic-title', kbd: 'kbd-title' }
];
function activeFields() { return allFields.filter((field) => state.selectedFieldKeys.includes(field.key)); }

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceSupported = Boolean(SpeechRecognitionImpl);
if (voiceSupported) {
  $('voice-hint').classList.remove('hidden');
} else {
  allFields.forEach(({ mic }) => $(mic)?.classList.add('hidden'));
}
let activeRecognition = null;
let activeMicButton = null;
function resetMicButton(button) {
  if (!button) return;
  button.classList.remove('listening');
  button.disabled = false;
  button.textContent = '🎤';
}
function stopActiveDictation() {
  if (activeRecognition) { try { activeRecognition.abort(); } catch (error) { /* déjà arrêté */ } }
  resetMicButton(activeMicButton);
  activeRecognition = null; activeMicButton = null;
}
function startDictation(button, input) {
  stopActiveDictation(); // une seule dictée à la fois, et on repart toujours d'un état propre
  let recognition;
  try {
    recognition = new SpeechRecognitionImpl();
  } catch (error) {
    alert("La dictée vocale n'a pas pu démarrer sur ce navigateur.");
    return;
  }
  recognition.lang = 'fr-FR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  button.classList.add('listening'); button.disabled = true; button.textContent = '…';
  activeRecognition = recognition; activeMicButton = button;
  let settled = false;
  const cleanup = () => {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    resetMicButton(button);
    if (activeRecognition === recognition) { activeRecognition = null; activeMicButton = null; }
  };
  // Filet de sécurité : certains navigateurs ne déclenchent pas toujours l'événement de fin
  // de la reconnaissance vocale, ce qui laisserait le bouton bloqué indéfiniment.
  const watchdog = setTimeout(() => { try { recognition.abort(); } catch (error) { /* déjà arrêté */ } cleanup(); }, 8000);
  recognition.addEventListener('result', (event) => {
    // Pas de focus() ici : sur smartphone, focus() ouvre le clavier virtuel automatiquement.
    // On laisse le bouton clavier ⌨️ à côté du champ pour une correction volontaire.
    input.value = event.results[0][0].transcript.trim();
  });
  recognition.addEventListener('end', cleanup);
  recognition.addEventListener('error', (event) => {
    cleanup();
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      alert("Le micro n'est pas autorisé pour ce site. Vérifiez les permissions du navigateur.");
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      alert("La dictée vocale n'a pas fonctionné. Réessayez, ou saisissez la réponse au clavier.");
    }
  });
  try {
    recognition.start();
  } catch (error) {
    cleanup();
    alert("Impossible de démarrer le micro. Réessayez.");
  }
}
if (voiceSupported) {
  allFields.forEach(({ input, mic }) => {
    const button = $(mic);
    button.addEventListener('click', () => startDictation(button, $(input)));
  });
}
// Bouton clavier : ouvre volontairement le clavier virtuel pour corriger une dictée,
// sans qu'il apparaisse automatiquement à la fin de la reconnaissance vocale.
allFields.forEach(({ input, kbd }) => {
  $(kbd)?.addEventListener('click', () => $(input).focus());
});

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
function saveInputs() {
  const answer = answerFor(state.index);
  activeFields().forEach(({ key, input }) => answer[key] = $(input).value);
}
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    let currentRow = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      currentRow.push(Math.min(
        currentRow[j] + 1,        // insertion
        previousRow[j + 1] + 1,   // suppression
        previousRow[j] + cost     // substitution
      ));
    }
    previousRow = currentRow;
  }
  return previousRow[b.length];
}
function typoTolerance(length) {
  // Seuil volontairement strict sur les mots courts : beaucoup de noms de peintres à 5 lettres
  // ne diffèrent que d'une lettre (Monet / Manet, Degas / ..., etc.), donc une tolérance y créerait
  // de fausses bonnes réponses entre deux artistes réels et différents.
  if (length <= 5) return 0;
  if (length <= 8) return 1;
  if (length <= 12) return 2;
  return 3;
}
function isCloseEnough(a, b) {
  if (!a || !b) return false;
  return levenshteinDistance(a, b) <= typoTolerance(Math.max(a.length, b.length));
}
function yearsOf(text) {
  // Extrait les années à 4 chiffres présentes dans un texte (ex. "vers 1784", "1780-1789").
  const matches = String(text).match(/\b(1[0-9]{3}|20[0-9]{2})\b/g);
  return matches ? matches.map(Number) : [];
}
function sameDecade(yearA, yearB) { return Math.floor(yearA / 10) === Math.floor(yearB / 10); }
function isMatch(actual, expected) {
  const answer = keyName(actual); const target = keyName(expected);
  if (!answer || !target) return false;
  if (answer === target) return true;
  // Dates : si la réponse attendue contient une année, on tolère toute année de la même décennie
  // (ex. la bonne date est 1784 : 1780 à 1789 sont acceptées) plutôt que d'exiger l'année exacte.
  const targetYears = yearsOf(target);
  if (targetYears.length) {
    const answerYears = yearsOf(answer);
    if (!answerYears.length) return false;
    return targetYears.some((targetYear) => answerYears.some((answerYear) => sameDecade(targetYear, answerYear)));
  }
  // Accepte un élément significatif de la réponse attendue : « Monet » ou « Orsay ».
  if (answer.length >= 3 && (target.includes(answer) || answer.includes(target))) return true;
  // Tolérance orthographique sur la réponse complète (accents, lettre en trop/en moins, inversion).
  if (isCloseEnough(answer, target)) return true;
  const targetWords = target.split(' ').filter(Boolean);
  const answerWords = answer.split(' ').filter(Boolean);
  // Réponse en un mot avec une faute (ex. « Monnet » pour « Claude Monet »).
  if (answerWords.length === 1 && targetWords.some((word) => word.length >= 4 && isCloseEnough(answer, word))) return true;
  // Réponse partielle en plusieurs mots avec une faute (ex. « Van Googh » pour « Vincent van Gogh »).
  if (answerWords.length > 1 && answerWords.length < targetWords.length) {
    for (let start = 0; start <= targetWords.length - answerWords.length; start += 1) {
      const windowText = targetWords.slice(start, start + answerWords.length).join(' ');
      if (isCloseEnough(answer, windowText)) return true;
    }
  }
  return false;
}
function correctCount(answer, question) { return activeFields().reduce((count, field) => count + Number(isMatch(answer[field.key], question[field.key])), 0); }
function isFullyCorrect(answer, question) { return answer?.checked && correctCount(answer, question) === activeFields().length; }
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

function selectedRubriquesLabel() {
  const labels = activeFields().map((field) => field.label);
  return labels.join(', ');
}
function showPanel(name) {
  // name: 'welcome' | 'quiz' | 'results' — centralise l'affichage des panneaux et de la barre
  // latérale (titre + import), visible uniquement sur la page d'accueil.
  $('welcome-panel').classList.toggle('hidden', name !== 'welcome');
  $('quiz-panel').classList.toggle('hidden', name !== 'quiz');
  $('results-panel').classList.toggle('hidden', name !== 'results');
  $('sidebar').classList.toggle('hidden', name !== 'welcome');
}

function renderQuestion() {
  stopActiveDictation(); // on ne garde jamais une dictée active d'une question à l'autre
  const question = state.questions[state.index]; const answer = answerFor(state.index);
  const modeLabel = state.mode === 'review' ? 'Révision des erreurs — ' : '';
  $('question-count').textContent = `${modeLabel}Question ${state.index + 1} sur ${state.questions.length}`;
  $('progress-bar').style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
  const possible = checkedQuestions() * activeFields().length;
  $('score-summary').textContent = `${totalCorrect()} / ${possible} point${totalCorrect() > 1 ? 's' : ''}`;
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
  allFields.forEach(({ key, input, mic, kbd }) => {
    const wrapper = $(input).closest('label');
    const active = state.selectedFieldKeys.includes(key);
    wrapper.classList.toggle('hidden', !active);
    $(input).value = answer[key];
    $(input).disabled = answer.checked;
    $(input).required = active;
    if (voiceSupported) { resetMicButton($(mic)); $(mic).disabled = answer.checked; }
    $(kbd).disabled = answer.checked;
  });
  $('answer-form').classList.toggle('hidden', answer.checked);
  $('correction').classList.toggle('hidden', !answer.checked);
  document.body.classList.toggle('is-corrected', answer.checked);
  if (answer.checked) renderCorrection(answer, question);
  $('previous-button').disabled = state.index === 0;
  $('next-button').textContent = state.index === state.questions.length - 1 ? 'Voir le score' : 'Suivante →';
}
function renderCorrection(answer, question) {
  $('correction-details').innerHTML = allFields.map(({ key, label }) => {
    const tested = state.selectedFieldKeys.includes(key);
    const value = escapeHtml(question[key]);
    if (!tested) {
      // Rubrique non cochée : affichée à titre d'information complète, sans notation ✓/✕.
      return `<p class="correction-extra"><span class="correction-label">${label} (info)</span><strong class="correction-value">${value}</strong></p>`;
    }
    const correct = isMatch(answer[key], question[key]);
    return `<p><span class="correction-label">${label}</span><span class="answer-result ${correct ? 'correct' : 'incorrect'}">${correct ? 'Correct ✓' : 'À réviser ✕'}</span><strong class="correction-value">${value}</strong></p>`;
  }).join('');
}
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }

function showResults() {
  saveInputs(); showPanel('results');
  const correct = totalCorrect(); const possible = state.questions.length * activeFields().length; const percent = possible ? Math.round((correct / possible) * 100) : 0;
  $('final-score').textContent = `${correct} / ${possible} (${percent} %)`;
  $('final-message').textContent = percent === 100 ? 'Parfait ! Toutes les informations sont justes.' : percent >= 70 ? 'Très bon résultat. Revoyez les réponses restantes pour consolider vos repères.' : 'Continuez : la correction est disponible pour chaque œuvre.';

  const missedCount = state.questions.filter((question, index) => !isFullyCorrect(state.answers[index], question)).length;
  const reviewButton = $('review-errors-button');
  if (missedCount > 0) {
    reviewButton.classList.remove('hidden');
    reviewButton.textContent = `Revoir les ${missedCount} question${missedCount > 1 ? 's' : ''} ratée${missedCount > 1 ? 's' : ''}`;
  } else {
    reviewButton.classList.add('hidden');
  }
  $('restart-full-button').classList.toggle('hidden', state.mode !== 'review' || state.fullQuestions.length === state.questions.length);
  $('export-feedback').classList.add('hidden');
}

function buildExportText() {
  const lines = [];
  const now = new Date();
  const dateLabel = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const correct = totalCorrect(); const possible = state.questions.length * activeFields().length; const percent = possible ? Math.round((correct / possible) * 100) : 0;
  lines.push("Quiz d'art — Résultats");
  lines.push(`${dateLabel} à ${timeLabel}`);
  if (state.mode === 'review') lines.push('Session de révision des erreurs');
  lines.push(`Rubriques testées : ${selectedRubriquesLabel()}`);
  lines.push(`Score final : ${correct} / ${possible} (${percent} %)`);
  lines.push('');
  lines.push('Détail par œuvre :');
  state.questions.forEach((question, index) => {
    const answer = state.answers[index];
    if (!answer?.checked) return;
    const score = correctCount(answer, question);
    lines.push('');
    lines.push(`${index + 1}. ${question.title || '(titre non renseigné)'} — ${question.artist || '(artiste non renseigné)'} [${score}/${activeFields().length}]`);
    activeFields().forEach(({ key, label }) => {
      const ok = isMatch(answer[key], question[key]);
      lines.push(`   - ${label} : ${ok ? 'correct' : 'à revoir'} (réponse attendue : ${question[key]})`);
    });
  });
  return lines.join('\n');
}

$('excel-file').addEventListener('change', async (event) => {
  const file = event.target.files[0]; if (!file) return;
  const chosenKeys = allFields.filter((field) => $(field.checkbox).checked).map((field) => field.key);
  if (!chosenKeys.length) { alert('Sélectionnez au moins une rubrique à réviser (artiste, date, lieu ou titre).'); event.target.value = ''; return; }
  try {
    if (!window.XLSX) throw new Error('Le module de lecture Excel n’a pas été chargé. Vérifiez votre connexion Internet et rechargez la page.');
    const data = await file.arrayBuffer(); const book = XLSX.read(data, { type: 'array' }); const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
    const questions = normaliseRows(rows); if (!questions.length) throw new Error('Aucune question utilisable n’a été trouvée dans le premier onglet.');
    state.selectedFieldKeys = chosenKeys;
    state.mode = 'normal';
    state.fullQuestions = shuffleQuestions(questions);
    state.questions = state.fullQuestions;
    state.answers = []; state.index = 0;
    showPanel('quiz'); renderQuestion();
  } catch (error) { alert(`Import impossible : ${error.message}`); }
  event.target.value = '';
});
function finalizeCurrentAnswer() {
  saveInputs();
  answerFor(state.index).checked = true;
}
function goToNextOrResults() {
  finalizeCurrentAnswer();
  if (state.index === state.questions.length - 1) { showResults(); }
  else { state.index++; renderQuestion(); }
}
$('answer-form').addEventListener('submit', (event) => {
  event.preventDefault();
  finalizeCurrentAnswer(); // note la réponse même si on ne clique jamais sur « Suivante »
  renderQuestion(); // affiche la correction ; on attend le clic sur « Suivante »
});
$('previous-button').addEventListener('click', () => { saveInputs(); if (state.index > 0) { state.index--; renderQuestion(); } });
$('next-button').addEventListener('click', goToNextOrResults);
$('review-button').addEventListener('click', () => {
  // Reprendre depuis le début le même jeu de questions (normal ou révision en cours)
  showPanel('quiz'); state.index = 0; renderQuestion();
});
$('review-errors-button').addEventListener('click', () => {
  const missed = state.questions.filter((question, index) => !isFullyCorrect(state.answers[index], question));
  if (!missed.length) return;
  state.mode = 'review';
  state.questions = missed;
  state.answers = [];
  state.index = 0;
  showPanel('quiz'); renderQuestion();
});
$('restart-full-button').addEventListener('click', () => {
  state.mode = 'normal';
  state.questions = state.fullQuestions;
  state.answers = [];
  state.index = 0;
  showPanel('quiz'); renderQuestion();
});
$('export-copy-button').addEventListener('click', async () => {
  const text = buildExportText();
  try {
    await navigator.clipboard.writeText(text);
    $('export-feedback').textContent = 'Résultats copiés dans le presse-papiers.';
  } catch (error) {
    $('export-feedback').textContent = "Impossible de copier automatiquement : sélectionnez et copiez le texte téléchargé.";
  }
  $('export-feedback').classList.remove('hidden');
});
$('export-download-button').addEventListener('click', () => {
  const text = buildExportText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url; link.download = `quiz-art-resultats-${stamp}.txt`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  URL.revokeObjectURL(url);
});
