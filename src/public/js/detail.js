  // Validasi rating di sisi klien (agar tidak tembus via link langsung)
  (function() {
    const postRating = document.getElementById('cytus-detail-config')?.dataset.rating || '';
    const isBypass = document.getElementById('cytus-detail-config')?.dataset.bypass === 'true';
    const filters = JSON.parse(localStorage.getItem('cytusGalleryFilters')) || {};
    const mainContent = document.getElementById('main-content');
    const errorContent = document.getElementById('error-content');
    const errorMessage = document.getElementById('error-message');
    
    let showError = (msg) => {
      if(mainContent) mainContent.classList.add('hidden');
      if(errorContent) errorContent.classList.remove('hidden');
      if(errorMessage) errorMessage.textContent = msg;
    };
    
    if ((postRating === 'e' || postRating === 'q') && !isBypass) {
      showError('Konten tidak ditemukan.');
      return;
    }
    
    if (filters.ratingToggle && filters.rating && filters.rating !== "all") {
      if (filters.rating === 'g' && postRating !== 'g') {
        showError('Konten ini tidak sesuai dengan filter Safe Anda.');
      } else if (filters.rating === 'not_e' && (postRating === 'q' || postRating === 'e')) {
        showError('Konten ini tidak sesuai dengan filter Moderate Anda.');
      }
    }
  })();
  // Logika untuk tombol Download
  const downloadButton = document.getElementById('download-button');
  if (downloadButton) {
    let isDownloading = false;
    window.addEventListener('beforeunload', (e) => {
      if (isDownloading) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    downloadButton.addEventListener('click', async () => {
      const fileUrl = document.getElementById('cytus-detail-config')?.dataset.fileurl || '';
      const filename = document.getElementById('cytus-detail-config')?.dataset.filename || '';

      // Beri feedback ke user dan siapkan progress bar UI
      downloadButton.innerHTML = `<div class="bg-cyan-800 absolute left-0 top-0 h-full" id="dl-progress" style="width: 0%"></div><span class="relative z-10">Menyiapkan unduhan...</span>`;
      downloadButton.classList.add('relative', 'overflow-hidden');
      downloadButton.disabled = true;
      isDownloading = true;

      const mobileContainer = document.getElementById('mobile-dl-container');
      const mobileBar = document.getElementById('mobile-dl-bar');
      const mobilePercent = document.getElementById('mobile-dl-percent');

      if (window.innerWidth < 768 && mobileContainer) {
        mobileContainer.classList.remove('hidden');
        mobileBar.style.width = '0%';
        mobilePercent.textContent = '0%';
      }

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;
        
        const reader = response.body.getReader();
        const chunks = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          if (total) {
            const percent = Math.round((loaded / total) * 100);
            document.getElementById('dl-progress').style.width = percent + '%';
            downloadButton.querySelector('span').textContent = `Downloading... ${percent}%`;
            
            if (mobileContainer && !mobileContainer.classList.contains('hidden')) {
              mobileBar.style.width = percent + '%';
              mobilePercent.textContent = percent + '%';
            }
          } else {
            const kb = Math.round(loaded/1024);
            downloadButton.querySelector('span').textContent = `Downloading... ${kb}KB`;

            if (mobileContainer && !mobileContainer.classList.contains('hidden')) {
              mobilePercent.textContent = kb + 'KB';
            }
          }
        }
        
        const blob = new Blob(chunks);
        const blobUrl = window.URL.createObjectURL(blob);

        // Buat link sementara, klik, lalu hapus
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Hapus link dan URL sementara
        window.URL.revokeObjectURL(blobUrl);
        a.remove();
      } catch (err) {
        console.error('Download error:', err);
        alert('Gagal mengunduh file.');
      } finally {
        // Kembalikan tombol ke keadaan semula
        downloadButton.innerHTML = `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg><span class="truncate text-base">Download</span>`;
        downloadButton.classList.remove('relative', 'overflow-hidden');
        downloadButton.disabled = false;
        isDownloading = false;
        
        if (mobileContainer) {
          mobileContainer.classList.add('hidden');
        }
      }
    });
  }

  // Logika untuk Expand/Collapse General Tags
  const collapseTriggers = document.querySelectorAll('.collapse-trigger');
  collapseTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const content = trigger.nextElementSibling;
      const icon = trigger.querySelector('.collapse-icon');
      if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.classList.add('rotate-180');
      } else {
        content.classList.add('hidden');
        icon.classList.remove('rotate-180');
      }
    });
  });

  // Logika untuk Tombol Follow Tag
  const followBtns = document.querySelectorAll('.follow-btn');
  followBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      const tagName = btn.dataset.tag;
      const tagType = btn.dataset.type;
      
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<svg class="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
      btn.disabled = true;
      
      try {
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagName, tagType })
        });
        
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        
        if (!res.ok) {
           if (res.status === 401) window.location.href = '/login';
           else {
             try {
               const errData = await res.json();
               if (errData.error) {
                 if (typeof window.showToast === 'function') window.showToast(errData.error, 'error');
                 else alert(errData.error);
                 return;
               }
             } catch (e) {}
             
             if (typeof window.showToast === 'function') window.showToast('Gagal memproses permintaan.', 'error');
             else alert('Gagal memproses permintaan.');
           }
           return;
        }
        
        const data = await res.json();
        if (typeof window.showToast === 'function') {
           window.showToast(data.message, data.followed ? 'success' : 'info');
        }
        
        // Toggle visual
        const followIcon = btn.querySelector('.follow-icon');
        const followedIcon = btn.querySelector('.followed-icon');
        
        if (data.followed) {
          btn.classList.replace('text-gray-400', 'text-white');
          btn.classList.replace('hover:bg-gray-500', 'bg-cyan-600');
          btn.classList.add('hover:bg-cyan-700');
          btn.title = 'Unfollow';
          if(followIcon) followIcon.classList.replace('block', 'hidden');
          if(followedIcon) followedIcon.classList.replace('hidden', 'block');
        } else {
          btn.classList.replace('text-white', 'text-gray-400');
          btn.classList.replace('bg-cyan-600', 'hover:bg-gray-500');
          btn.classList.remove('hover:bg-cyan-700');
          btn.title = 'Follow';
          if(followedIcon) followedIcon.classList.replace('block', 'hidden');
          if(followIcon) followIcon.classList.replace('hidden', 'block');
        }
      } catch (err) {
        console.error(err);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        if (typeof window.showToast === 'function') {
          window.showToast('Gagal memproses permintaan.', 'error');
        }
      }
    });
  });
  // === LOGIKA SHARE & MODAL ===
  document.addEventListener('DOMContentLoaded', () => {
    const shareButton = document.getElementById('share-button');
    const modal = document.getElementById('success-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const backdrop = document.getElementById('success-modal-backdrop');

    // Fungsi: Tampilkan Modal
    const showSuccessModal = () => {
      modal.classList.remove('opacity-0', 'pointer-events-none');
      modal.querySelector('.transform').classList.remove('scale-95');
      modal.querySelector('.transform').classList.add('scale-100');
    };

    // Fungsi: Sembunyikan Modal
    const hideSuccessModal = () => {
      modal.classList.add('opacity-0', 'pointer-events-none');
      modal.querySelector('.transform').classList.add('scale-95');
      modal.querySelector('.transform').classList.remove('scale-100');
    };

    // Event Listener Tutup Modal
    if (closeModalBtn) closeModalBtn.addEventListener('click', hideSuccessModal);
    if (backdrop) backdrop.addEventListener('click', hideSuccessModal);

    // Event Listener Tombol Share
    if (shareButton) {
      shareButton.addEventListener('click', async () => {
        const url = window.location.href;

        // Fungsi Helper: Copy Manual (Fallback untuk HTTP/Mobile Lama)
        const manualCopy = () => {
          const textArea = document.createElement("textarea");
          textArea.value = url;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
            showSuccessModal(); // Tampilkan modal sukses
          } catch (err) {
            prompt('Salin link manual:', url);
          }
          document.body.removeChild(textArea);
        };

        try {
          // Coba cara modern dulu (Clipboard API)
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            showSuccessModal(); // Tampilkan modal sukses
          } else {
            throw new Error("Clipboard API unavailable");
          }
        } catch (err) {
          // Jika gagal (misal karena belum HTTPS), pakai cara manual
          manualCopy();
        }
      });
    }

    // Logika untuk tombol Simpan
    const saveButton = document.getElementById('save-button');
    if (saveButton) {
      saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        const originalHtml = saveButton.innerHTML;
        saveButton.innerHTML = `
          <svg class="animate-spin mr-1.5 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span id="save-button-text">Menyimpan...</span>
        `;
        
        try {
          const res = await fetch(`/api/save/${document.getElementById('cytus-detail-config')?.dataset.postid}`, { method: 'POST' });
          const data = await res.json();
          
          if (data.saved !== undefined) {
            saveButton.innerHTML = `
              <svg class="w-5 h-5" fill="${data.saved ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
              <span id="save-button-text">${data.saved ? 'Tersimpan' : 'Simpan Konten'}</span>
            `;
            
            saveButton.classList.remove('bg-yellow-600', 'bg-green-600', 'hover:bg-yellow-700', 'hover:bg-green-700');
            if (data.saved) {
              saveButton.classList.add('bg-green-600', 'hover:bg-green-700');
            } else {
              saveButton.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
            }
            
            if (typeof window.showToast === 'function') {
              window.showToast(data.message, data.saved ? 'success' : 'info');
            } else {
              alert(data.message);
            }
          } else {
            throw new Error(data.error || "Gagal menyimpan konten");
          }
        } catch (err) {
          console.error(err);
          saveButton.innerHTML = originalHtml;
          if (typeof window.showToast === 'function') {
            window.showToast('Gagal menyimpan konten.', 'error');
          } else {
            alert('Terjadi kesalahan saat menyimpan konten.');
          }
        } finally {
          saveButton.disabled = false;
        }
      });
    }
  });