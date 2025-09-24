// Minimal client-side logic for the live editor

(function(){
	const htmlEditor = document.getElementById('htmlEditor');
	const cssEditor = document.getElementById('cssEditor');
	const jsEditor = document.getElementById('jsEditor');
	const output = document.getElementById('output');
	const runBtn = document.getElementById('runBtn');
	const autorunChk = document.getElementById('autorun');
	const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');
	const downloadBtn = document.getElementById('downloadBtn');
	const clearBtn = document.getElementById('clearBtn');
	const openBtn = document.getElementById('openBtn');
	const sizeLabel = document.getElementById('sizeLabel');
	const previewButtons = document.querySelectorAll('.preview-bar button');
	const togglePreviewBtn = document.getElementById('togglePreviewBtn');

	const STORAGE_KEY = 'mini-codepen-state-v1';

	// Default starter content
	const DEFAULT = {
		html: "<h1>Hello World</h1>\n<p>Edit the code and press Run or enable Auto-run.</p>",
		css: "body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:16px;color:#0b1220}\nh1{color:#4f46e5}",
		js: "console.log('Hello from JS');"
	};

	// Load saved
	function load() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if(raw){
				const data = JSON.parse(raw);
				htmlEditor.value = data.html ?? DEFAULT.html;
				cssEditor.value = data.css ?? DEFAULT.css;
				jsEditor.value = data.js ?? DEFAULT.js;
				autorunChk.checked = !!data.autorun;
				if(data.layout === 'stacked') document.body.classList.add('stacked');
				else document.body.classList.add('side-by-side');
			} else {
				htmlEditor.value = DEFAULT.html;
				cssEditor.value = DEFAULT.css;
				jsEditor.value = DEFAULT.js;
				document.body.classList.add('side-by-side');
			}
		} catch(e){
			htmlEditor.value = DEFAULT.html;
			cssEditor.value = DEFAULT.css;
			jsEditor.value = DEFAULT.js;
			document.body.classList.add('side-by-side');
		}
	}
	// Save state
	function save() {
		const payload = {
			html: htmlEditor.value,
			css: cssEditor.value,
			js: jsEditor.value,
			autorun: autorunChk.checked,
			layout: document.body.classList.contains('stacked') ? 'stacked' : 'side-by-side'
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	}

	// Build full HTML for iframe
	function buildSrcDoc(){
		const html = htmlEditor.value;
		// ensure iframe content is transparent by default so the iframe surface color shows through
		const css = `<style>html,body{background:transparent;margin:0;padding:0;}</style><style>${cssEditor.value}</style>`;
		const js = `<script>\ntry{${jsEditor.value}\n}catch(e){console.error(e)}\n<\/script>`;
		return `<!doctype html><html><head><meta charset="utf-8">${css}</head><body>${html}${js}</body></html>`;
	}

	// show saved indicator helper
	const savedIndicatorEl = document.getElementById('savedIndicator');
	function showSavedIndicator(){
		if(!savedIndicatorEl) return;
		savedIndicatorEl.classList.add('visible');
		setTimeout(()=> savedIndicatorEl.classList.remove('visible'), 1400);
	}

	// update save to show indicator
	const originalSave = save;
	save = function(){
		originalSave();
		showSavedIndicator();
	};

	// Update preview
	function run(){
		// fade output first
		if(output) output.classList.add('fading');
		const doc = buildSrcDoc();
		try {
			output.srcdoc = doc;
			// when iframe loads, remove fading
			output.onload = ()=> {
				if(output) output.classList.remove('fading');
			};
		} catch(e) {
			const w = output.contentWindow;
			w.document.open();
			w.document.write(doc);
			w.document.close();
			// give it a small timeout then remove fading
			setTimeout(()=> { if(output) output.classList.remove('fading'); }, 250);
		}
		save();
	}

	// Debounce helper
	function debounce(fn, wait=500){
		let t;
		return function(...args){
			clearTimeout(t);
			t = setTimeout(()=>fn.apply(this,args), wait);
		};
	}

	// UI wiring
	runBtn.addEventListener('click', run);
	autorunChk.addEventListener('change', save);

	// Autorun when typing
	const autoRunner = debounce(()=>{ if(autorunChk.checked) run(); }, 600);
	[htmlEditor, cssEditor, jsEditor].forEach(el => {
		el.addEventListener('input', () => {
			save();
			autoRunner();
		});
	});

	// Toggle layout
	toggleLayoutBtn.addEventListener('click', ()=>{
		if(document.body.classList.contains('stacked')){
			document.body.classList.remove('stacked');
			document.body.classList.add('side-by-side');
		} else {
			document.body.classList.remove('side-by-side');
			document.body.classList.add('stacked');
		}
		save();
	});

	// Download combined HTML -> replaced with "download all as zip"
	if(downloadBtn){
		downloadBtn.addEventListener('click', async ()=>{
			// Try to load JSZip dynamically from CDN
			try {
				if(!window.JSZip){
					await new Promise((res, rej)=>{
						const s = document.createElement('script');
						s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
						s.onload = res;
						s.onerror = rej;
						document.head.appendChild(s);
					});
				}
				const zip = new window.JSZip();

				// preview.html: combined runnable document (same as iframe srcdoc)
				const previewContent = buildSrcDoc();

				// index viewer that simply opens preview.html
				const indexViewer = `<!doctype html>
	<html>
	<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview - Mini CodePen</title>
	<style>html,body{height:100%;margin:0}iframe{width:100%;height:100%;border:0}</style>
	</head>
	<body><iframe src="preview.html" sandbox="allow-scripts allow-same-origin"></iframe></body>
	</html>`;

				// README
				const readme = `Mini CodePen export
		Files:
		 - preview.html  (combined runnable page)
		 - code.html     (your HTML)
		 - code.css      (your CSS)
		 - code.js       (your JS)
		 - index.html    (viewer that opens preview.html)
		
		Open index.html in a browser or open preview.html directly.
		`;

				// Add files using the editors' current content
				zip.file('preview.html', previewContent);
				zip.file('code.html', htmlEditor.value);
				zip.file('code.css', cssEditor.value);
				zip.file('code.js', jsEditor.value);
				zip.file('index.html', indexViewer);
				zip.file('README.txt', readme);

				// generate zip
				const blob = await zip.generateAsync({type:'blob'});
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'mini-codepen.zip';
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
			} catch(err){
				// fallback: download single combined HTML (previous behavior)
				try{
					const blob = new Blob([buildSrcDoc()], {type:'text/html'});
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = 'preview.html';
					document.body.appendChild(a);
					a.click();
					a.remove();
					URL.revokeObjectURL(url);
				}catch(e){
					alert('Download failed.');
				}
			}
		});
	}

	// Clear
	clearBtn.addEventListener('click', ()=>{
		if(!confirm('Clear editors? This will reset code.')) return;
		htmlEditor.value = DEFAULT.html;
		cssEditor.value = DEFAULT.css;
		jsEditor.value = DEFAULT.js;
		run();
	});

	// Open preview in new window
	openBtn.addEventListener('click', ()=>{
		const win = window.open();
		if(!win) { alert('Popup blocked.'); return; }
		win.document.write(buildSrcDoc());
		win.document.close();
	});

	// Preview width controls
	previewButtons.forEach(btn=>{
		btn.addEventListener('click', ()=>{
			const w = btn.dataset.width;
			if(w === 'device'){
				output.style.width = '';
				output.style.maxWidth = '100%';
				output.style.height = '';
				sizeLabel.textContent = '';
			} else {
				output.style.width = w;
				output.style.maxWidth = '';
				output.style.height = '600px';
				sizeLabel.textContent = w;
			}
		});
	});

	// Keyboard shortcut Ctrl/Cmd + Enter to run
	window.addEventListener('keydown', (e)=>{
		if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
			e.preventDefault();
			run();
		}
	});

	// Preview nav: smooth-scroll to preview section and close mobile menu if open
	if(togglePreviewBtn){
		togglePreviewBtn.addEventListener('click', (e)=>{
			e.preventDefault();
			const previewEl = document.getElementById('preview');
			if(!previewEl) return;
			// If mobile menu is open, close it so preview is visible
			const mobileMenu = document.getElementById('mobileMenu');
			const navToggle = document.getElementById('navToggle');
			if(mobileMenu && mobileMenu.classList.contains('open') && navToggle){
				// trigger the toggle to close (keeps existing move-back logic)
				navToggle.click();
			}
			// Smooth scroll preview into view
			try {
				previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
			} catch(err){
				// fallback
				window.scrollTo({ top: previewEl.offsetTop, behavior: 'smooth' });
			}
			// focus Run button for keyboard users (no scroll)
			if(runBtn) runBtn.focus({ preventScroll: true });
		});
	}

	// Tab / Shift+Tab indentation for textareas
	function handleTabKey(e, textarea){
		if(e.key !== 'Tab') return;
		e.preventDefault();
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const value = textarea.value;
		const tab = '  '; // two spaces
		if(e.shiftKey){
			// unindent: remove leading tab spaces from selected lines
			const before = value.slice(0, start);
			const selected = value.slice(start, end);
			const lines = selected.split('\n');
			let removed = 0;
			const newLines = lines.map(line => {
				if(line.startsWith(tab)){ removed += tab.length; return line.slice(tab.length); }
				if(line.startsWith(' ')) { removed += 1; return line.slice(1); }
				return line;
			});
			const newVal = before + newLines.join('\n') + value.slice(end);
			textarea.value = newVal;
			textarea.selectionStart = start;
			textarea.selectionEnd = end - removed;
		} else {
			// insert tab at selection or at caret
			const newVal = value.slice(0, start) + tab + value.slice(start, end) + value.slice(end);
			textarea.value = newVal;
			textarea.selectionStart = textarea.selectionEnd = start + tab.length;
		}
		// persist and (optionally) autorun
		save();
		if(autorunChk.checked) run();
	}

	[htmlEditor, cssEditor, jsEditor].forEach(el=>{
		if(!el) return;
		el.addEventListener('keydown', (e)=>{
			if(e.key === 'Tab'){
				handleTabKey(e, el);
			}
		});
	});

	// Ctrl+S to save
	window.addEventListener('keydown', (e)=>{
		if((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')){
			e.preventDefault();
			save();
		}
	});

	// copy button wiring
	function copyTextToClipboard(text){
		if(navigator.clipboard && navigator.clipboard.writeText){
			return navigator.clipboard.writeText(text);
		}
		// fallback
		return new Promise((resolve, reject) => {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			try{
				document.execCommand('copy');
				resolve();
			}catch(e){
				reject(e);
			}finally{
				ta.remove();
			}
		});
	}

	// ensure a live region for accessibility announcements
	let clipLive = document.getElementById('clipboardAnnouncer');
	if(!clipLive){
		clipLive = document.createElement('div');
		clipLive.id = 'clipboardAnnouncer';
		clipLive.setAttribute('aria-live','polite');
		clipLive.setAttribute('aria-atomic','true');
		clipLive.style.position = 'fixed';
		clipLive.style.left = '-9999px';
		clipLive.style.width = '1px';
		clipLive.style.height = '1px';
		clipLive.style.overflow = 'hidden';
		document.body.appendChild(clipLive);
	}

	document.querySelectorAll('.copy-btn').forEach(btn=>{
		btn.addEventListener('click', async (e)=>{
			const targetId = btn.dataset.target;
			if(!targetId) return;
			const ta = document.getElementById(targetId);
			if(!ta) return;
			const text = ta.value;

			// attempt copy
			try{
				await copyTextToClipboard(text);

				// create small inline badge (avoid clipped pseudo-element)
				let badge = btn.querySelector('.copied-badge');
				if(!badge){
					badge = document.createElement('span');
					badge.className = 'copied-badge';
					badge.textContent = 'Copied';
					btn.appendChild(badge);
				}

				// Decide whether to show badge above the button or inside it (fallback)
				const rect = btn.getBoundingClientRect();
				const spaceAbove = rect.top; // pixels from top of viewport
				// if not enough space above (e.g. near top), show inside
				if(spaceAbove < 72){
					btn.classList.add('small-badge');
				} else {
					btn.classList.remove('small-badge');
				}

				// mark state for styling and screen readers
				btn.classList.add('copied');
				btn.setAttribute('aria-pressed','true');
				clipLive.textContent = 'Copied to clipboard';

				// remove state after short delay
				setTimeout(()=>{
					btn.classList.remove('copied');
					btn.classList.remove('small-badge'); // remove fallback class too
					btn.removeAttribute('aria-pressed');
					// fade/remove badge
					if(badge && badge.parentNode){
						badge.parentNode.removeChild(badge);
					}
					// clear live text
					clipLive.textContent = '';
				}, 1400);
			}catch(err){
				// fallback: briefly flash red background to indicate failure
				const prev = btn.style.background;
				btn.style.background = 'rgba(255,80,80,0.12)';
				clipLive.textContent = 'Copy failed';
				setTimeout(()=> {
					btn.style.background = prev;
					clipLive.textContent = '';
				}, 900);
			}
		});
	});

	// Initial load
	load();
	run();
})();

// Responsive nav handling: move .controls into mobile menu when opened on small screens
(function(){
	const navToggle = document.getElementById('navToggle');
	const mobileMenu = document.getElementById('mobileMenu');
	const controls = document.querySelector('.controls');
	let controlsPlaceholder = null;
	const MOBILE_BREAKPOINT = 820;

	function openMobileMenu(){
		if(!mobileMenu || !controls) return;
		// place a placeholder so we can restore position later
		if(!controlsPlaceholder){
			controlsPlaceholder = document.createElement('div');
			controlsPlaceholder.className = 'controls-placeholder';
		}
		if(controls.parentNode && controls.parentNode !== mobileMenu){
			controls.parentNode.replaceChild(controlsPlaceholder, controls);
			mobileMenu.appendChild(controls);
		}
		mobileMenu.classList.add('open');
		mobileMenu.setAttribute('aria-hidden','false');
		if(navToggle) navToggle.setAttribute('aria-expanded','true');
	}

	function closeMobileMenu(){
		if(!mobileMenu || !controls || !controlsPlaceholder) return;
		// move controls back to placeholder position
		if(controlsPlaceholder.parentNode){
			controlsPlaceholder.parentNode.replaceChild(controls, controlsPlaceholder);
		}
		mobileMenu.classList.remove('open');
		mobileMenu.setAttribute('aria-hidden','true');
		if(navToggle) navToggle.setAttribute('aria-expanded','false');
	}

	if(navToggle && mobileMenu && controls){
		navToggle.addEventListener('click', (e)=>{
			const open = mobileMenu.classList.contains('open');
			if(open) closeMobileMenu();
			else openMobileMenu();
		});

		// close on outside click
		document.addEventListener('click', (ev)=>{
			if(!mobileMenu.classList.contains('open')) return;
			const path = ev.composedPath ? ev.composedPath() : (ev.path || []);
			if(!path.includes(mobileMenu) && !path.includes(navToggle)){
				closeMobileMenu();
			}
		});

		// close on Escape
		document.addEventListener('keydown', (ev)=>{
			if(ev.key === 'Escape' && mobileMenu.classList.contains('open')){
				closeMobileMenu();
				if(navToggle) navToggle.focus();
			}
		});

		// if resized to desktop, ensure controls are restored
		window.addEventListener('resize', ()=>{
			if(window.innerWidth > MOBILE_BREAKPOINT && mobileMenu.classList.contains('open')){
				closeMobileMenu();
			}
		});
	}
})();
