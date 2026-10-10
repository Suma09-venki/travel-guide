const VOICES = {
  English: { Male: "Matthew", Female: "Alicia" },
  Hindi: { Male: "Aman", Female: "Namrita" },
  Tamil: { Male: "Murali", Female: "Iniya" },
  Telugu: { Male: "Zion", Female: "Josie" }
};

const LOCALES = {
  English: "en-US",
  Hindi: "hi-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN"
};

// Same-origin when served by Flask (local :5000 or deployed). Otherwise (Live Server / file://) use local Flask.
const API_BASE = (location.protocol !== "file:" && ["", "5000"].includes(location.port)) ? "" : "http://127.0.0.1:5000";
const GENERATE_AUDIO_GUIDE_API_URL = `${API_BASE}/generate-audio-guide`;
const GENERATE_ITINERARY_API_URL = `${API_BASE}/generate-itinerary`;

const FALLBACK_IMAGE = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a1f"/><stop offset="1" stop-color="#ff6a00"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><text x="300" y="215" font-size="64" text-anchor="middle" fill="white">🧭</text></svg>'
);

// --- State ---
const state = {
  place: '',
  image: '',
  length: 'Summary',
  voice: 'Male',
  audioReady: false
};

// --- DOM Elements ---
const cardsContainer = document.querySelector('.cards');
const experiencePanel = document.getElementById('experience');
const previewTitle = document.getElementById('previewTitle');
const audioSection = document.getElementById('audioSection');
const audioPlayer = document.getElementById('audioPlayer');
const transcriptText = document.getElementById('scriptText');
const generateButton = document.getElementById('generateBtn');
const languageSelect = document.getElementById('selectLanguage');
const closeButton = document.getElementById('closeExperience');
const searchPreviewCard = document.getElementById('searchPreviewCard');
const searchPreviewImage = document.getElementById('searchPreviewImage');
const searchPreviewTitle = document.getElementById('searchPreviewTitle');
const transcriptToggle = document.getElementById('transcriptToggle');
const transcriptContent = document.getElementById('transcriptContent');
const transcriptArrow = document.getElementById('transcriptArrow');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const itineraryDays = document.getElementById('itineraryDays');
const itineraryBtn = document.getElementById('itineraryBtn');
const itineraryOutput = document.getElementById('itineraryOutput');

// --- Functions ---

function resetAudio() {
  state.audioReady = false;
  audioPlayer.pause();
  audioPlayer.removeAttribute('src');
  audioSection.classList.add('hidden');
  transcriptText.textContent = '';
  generateButton.textContent = 'Generate Audio Guide';
  generateButton.disabled = false;
}

function resetItinerary() {
  itineraryOutput.textContent = '';
  itineraryOutput.classList.add('hidden');
  itineraryBtn.textContent = '🧭 Plan My Trip';
  itineraryBtn.disabled = false;
}

function selectDestination(place, image, clickedCard = null) {
  state.place = place;
  state.image = image;

  previewTitle.textContent = place;
  cardsContainer.classList.add('faded');

  document.querySelectorAll('.place-card').forEach(card => card.classList.remove('active'));
  searchPreviewCard.classList.add('hidden');

  if (clickedCard) {
    clickedCard.classList.add('active');
  } else {
    searchPreviewImage.src = image;
    searchPreviewTitle.textContent = place;
    searchPreviewCard.classList.remove('hidden');
    searchPreviewCard.classList.add('active');
  }

  resetAudio();
  resetItinerary();

  experiencePanel.classList.remove('hidden');
  setTimeout(() => {
    experiencePanel.classList.add('visible');
  }, 10);
}

function deselectDestination() {
  experiencePanel.classList.remove('visible');
  audioPlayer.pause();

  setTimeout(() => {
    experiencePanel.classList.add('hidden');
    cardsContainer.classList.remove('faded');
    searchPreviewCard.classList.add('hidden');
    document.querySelectorAll('.place-card').forEach(card => card.classList.remove('active'));
  }, 300);
}

function toTitleCase(text) {
  return text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  const cards = [...document.querySelectorAll('.place-card:not(.search-preview-card)')];
  const match = cards.find(c => c.dataset.place.toLowerCase().includes(query.toLowerCase()));

  if (match) {
    selectDestination(match.dataset.place, match.dataset.image, match);
  } else {
    selectDestination(toTitleCase(query), FALLBACK_IMAGE);
  }
  searchInput.value = '';
}

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await response.json(); } catch (_) { /* non-JSON error body */ }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// --- Event Listeners ---

closeButton.addEventListener('click', deselectDestination);

// Search
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
});

// Card Clicks
document.querySelectorAll('.place-card:not(.search-preview-card)').forEach(card => {
  card.addEventListener('click', () => {
    selectDestination(card.dataset.place, card.dataset.image, card);
  });
});

// Length toggle
const lengthButtons = document.querySelectorAll('[data-group="length"] button');
lengthButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    lengthButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.length = btn.dataset.value;
    resetAudio();
  });
});

// Voice toggle
const voiceButtons = document.querySelectorAll('[data-group="voice"] button');
voiceButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    voiceButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.voice = btn.dataset.value;
    resetAudio();
  });
});

// Language change invalidates old audio and itinerary
languageSelect.addEventListener('change', () => {
  resetAudio();
  resetItinerary();
});

// Generate / play audio guide
generateButton.addEventListener('click', async () => {
  if (state.audioReady) {
    audioPlayer.currentTime = 0;
    audioPlayer.play().catch(() => {});
    return;
  }

  generateButton.disabled = true;
  generateButton.textContent = '⏳ Generating Audio...';

  try {
    const selectedLanguage = languageSelect.value;
    const data = await postJSON(GENERATE_AUDIO_GUIDE_API_URL, {
      place: state.place,
      answerType: state.length,
      language: selectedLanguage,
      voiceId: VOICES[selectedLanguage][state.voice],
      locale: LOCALES[selectedLanguage]
    });

    transcriptText.textContent = data.description;
    audioSection.classList.remove('hidden');

    if (data.audioBase64) {
      audioPlayer.src = `data:audio/mp3;base64,${data.audioBase64}`;
      audioPlayer.load();
      audioPlayer.classList.remove('hidden');
      state.audioReady = true;
      generateButton.textContent = '▶ Play Audio';
      audioPlayer.play().catch(() => {}); // autoplay may be blocked; the button still works
    } else {
      audioPlayer.classList.add('hidden');
      generateButton.textContent = 'Retry Audio';
      if (data.audioError) alert('Transcript is ready, but audio failed:\n' + data.audioError);
    }
    generateButton.disabled = false;
  } catch (err) {
    console.error(err);
    alert('Generation failed: ' + err.message);
    generateButton.textContent = 'Generate Audio Guide';
    generateButton.disabled = false;
  }
});

// Itinerary
itineraryBtn.addEventListener('click', async () => {
  itineraryBtn.disabled = true;
  itineraryBtn.textContent = '⏳ Planning...';

  try {
    const data = await postJSON(GENERATE_ITINERARY_API_URL, {
      place: state.place,
      days: Number(itineraryDays.value),
      language: languageSelect.value
    });
    itineraryOutput.textContent = data.itinerary;
    itineraryOutput.classList.remove('hidden');
    itineraryBtn.textContent = '🔄 Re-plan Trip';
  } catch (err) {
    console.error(err);
    alert('Itinerary failed: ' + err.message);
    itineraryBtn.textContent = '🧭 Plan My Trip';
  }
  itineraryBtn.disabled = false;
});

// Transcript Toggle
transcriptToggle.addEventListener('click', () => {
  transcriptContent.classList.toggle('hidden');
  transcriptArrow.classList.toggle('rotate-180');
});
