window.savePostOverlay = async function(event, postId, btnEl) {
  event.preventDefault();
  event.stopPropagation();
  
  btnEl.disabled = true;
  const originalHtml = btnEl.innerHTML;
  btnEl.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
  
  try {
    const res = await fetch('/api/save/' + postId, { method: 'POST' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    
    if (data.saved !== undefined) {
      const galleryItem = btnEl.closest('.gallery-item');
      if (data.saved) {
        btnEl.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'bg-yellow-600', 'hover:bg-yellow-700');
        btnEl.classList.add('bg-green-600', 'hover:bg-green-700');
        btnEl.innerHTML = `<svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>`;
        if(galleryItem) galleryItem.classList.add('border-4', 'border-yellow-500');
      } else {
        btnEl.classList.remove('bg-green-600', 'hover:bg-green-700', 'bg-yellow-600', 'hover:bg-yellow-700');
        btnEl.classList.add('bg-gray-700', 'hover:bg-gray-600');
        btnEl.innerHTML = `<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>`;
        if(galleryItem) galleryItem.classList.remove('border-4', 'border-yellow-500');
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
    btnEl.innerHTML = originalHtml;
    if (typeof window.showToast === 'function') {
      window.showToast('Gagal menyimpan konten.', 'error');
    } else {
      alert('Terjadi kesalahan saat menyimpan konten.');
    }
  } finally {
    btnEl.disabled = false;
  }
};

window.forceDownload = async function(url, filename, btnEl) {
  event.preventDefault();
  event.stopPropagation();
  
  if (btnEl) btnEl.disabled = true;
  const originalHtml = btnEl ? btnEl.innerHTML : '';
  
  if (btnEl) {
    btnEl.innerHTML = `<svg class="animate-spin h-4 w-4 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Gagal mengunduh file.");
    const blob = await response.blob();
    
    // Attempt to guess extension from content type if URL doesn't have one
    const contentType = response.headers.get('content-type');
    let ext = url.split('.').pop().split(/#|\?/)[0];
    if (ext.length > 4 || !ext) {
      if (contentType === 'image/jpeg') ext = 'jpg';
      else if (contentType === 'image/png') ext = 'png';
      else if (contentType === 'image/gif') ext = 'gif';
      else if (contentType === 'video/mp4') ext = 'mp4';
      else if (contentType === 'video/webm') ext = 'webm';
      else ext = 'jpg'; // Fallback
    }
    
    const finalFilename = `${filename}.${ext}`;
    
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download error:', error);
    if (typeof window.showAlert === 'function') {
      window.showAlert('Error', 'Gagal mengunduh file. Kemungkinan dihalangi oleh browser (CORS).');
    } else {
      alert('Gagal mengunduh file.');
    }
  } finally {
    if (btnEl) {
      btnEl.innerHTML = originalHtml;
      btnEl.disabled = false;
    }
  }
};

// Animasi loading antar halaman telah dinonaktifkan atas permintaan pengguna.

// --- CUSTOM GLOBAL TOOLTIP ---
(function() {
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'fixed bg-gray-900 border border-gray-600 text-white text-xs px-2 py-1.5 rounded shadow-xl pointer-events-none opacity-0 transition-opacity duration-200 whitespace-nowrap';
  tooltipEl.style.zIndex = '999999';
  document.body.appendChild(tooltipEl);

  let tooltipTarget = null;

  document.addEventListener('mouseover', (e) => {
    // Nonaktifkan di mobile agar tidak mengganggu interaksi sentuh
    if(window.innerWidth < 768) return; 
    let target = e.target;
    
    while (target && target !== document) {
      if (target.hasAttribute('title') && target.getAttribute('title').trim() !== '') {
        target.setAttribute('data-tooltip', target.getAttribute('title'));
        target.removeAttribute('title');
      }
      if (target.hasAttribute('data-tooltip')) {
        tooltipTarget = target;
        tooltipEl.textContent = target.getAttribute('data-tooltip');
        tooltipEl.style.opacity = '1';
        positionTooltip(e);
        break;
      }
      target = target.parentNode;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (tooltipTarget) {
      positionTooltip(e);
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (tooltipTarget && (!e.relatedTarget || !tooltipTarget.contains(e.relatedTarget))) {
      tooltipEl.style.opacity = '0';
      tooltipTarget = null;
    }
  });

  const hideTooltip = () => {
    tooltipEl.style.opacity = '0';
    tooltipTarget = null;
  };
  document.addEventListener('mousedown', hideTooltip);
  document.addEventListener('touchstart', hideTooltip, {passive: true});
  window.addEventListener('scroll', hideTooltip, {passive: true});

  function positionTooltip(e) {
    let top = e.clientY + 15;
    let left = e.clientX + 15;
    
    if (left + tooltipEl.offsetWidth > window.innerWidth - 10) {
      left = e.clientX - tooltipEl.offsetWidth - 10;
    }
    if (top + tooltipEl.offsetHeight > window.innerHeight - 10) {
      top = e.clientY - tooltipEl.offsetHeight - 10;
    }
    
    tooltipEl.style.top = top + 'px';
    tooltipEl.style.left = left + 'px';
  }
})();
// Follow Search Tags Logic
window.handleFollowBtnClick = function(btnEl) {
  const tagsStr = btnEl.getAttribute('data-tags');
  const isCurrentlyFollowed = btnEl.getAttribute('data-all-followed') === 'true';
  const tagStatesStr = btnEl.getAttribute('data-tag-states');
  const tagStates = tagStatesStr.split(',').map(s => s === 'true');
  
  if (!isCurrentlyFollowed) {
    if (typeof window.showAlert === 'function') {
      window.showAlert("Ikuti Tag?", "Ketika mengikuti, Anda akan mendapatkan notifikasi jika ada konten terbaru pada tag ini", () => {
        window.toggleFollowSearchTags(btnEl, tagsStr, isCurrentlyFollowed, tagStates);
      });
      const confirmBtn = document.getElementById("custom-alert-confirm");
      if (confirmBtn) confirmBtn.textContent = "Ikuti";
    } else {
      window.toggleFollowSearchTags(btnEl, tagsStr, isCurrentlyFollowed, tagStates);
    }
  } else {
    window.toggleFollowSearchTags(btnEl, tagsStr, isCurrentlyFollowed, tagStates);
  }
};

window.toggleFollowSearchTags = async function(btnEl, tagsStr, isCurrentlyFollowed, tagStates) {
  const tags = tagsStr.split(',').filter(t => t.trim().length > 0);
  if (tags.length === 0) return;

  btnEl.disabled = true;
  const originalHtml = btnEl.innerHTML;
  btnEl.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span class="btn-text">Proses...</span>';

  try {
    if (isCurrentlyFollowed) {
      // Unfollow all
      for (const tag of tags) {
        await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagName: tag, tagType: 0 }) 
        });
      }
      window.showToast("Berhasil unfollow tag.", "success");
      
      // Update UI immediately
      btnEl.disabled = false;
      btnEl.setAttribute('data-all-followed', 'false');
      btnEl.className = "ml-2 px-3 py-1 text-sm font-medium rounded-full border transition-colors flex items-center gap-1 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700 hover:text-white";
      btnEl.title = 'Ikuti tag pencarian ini';
      btnEl.innerHTML = `<svg class="w-4 h-4 btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg><span class="btn-text">Ikuti Tag</span>`;
    } else {
      // Follow only those not followed
      let successCount = 0;
      let errorMessage = "";
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (tagStates[i]) continue; // Already followed, skip

        // Fetch tag category from Danbooru
        let category = 0;
        try {
          const res = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=` + encodeURIComponent(tag));
          const data = await res.json();
          if (data && data.length > 0) category = data[0].category;
        } catch(e) {
          console.error("Danbooru tag fetch failed", e);
        }

        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagName: tag, tagType: category })
        });
        const result = await res.json();
        if (res.status === 200) {
          successCount++;
        } else {
          errorMessage = result.error || "Gagal follow tag.";
        }
      }
      
      if (successCount > 0) {
        window.showToast("Berhasil follow tag.", "success");
        
        // Update UI immediately
        btnEl.disabled = false;
        btnEl.setAttribute('data-all-followed', 'true');
        btnEl.className = "ml-2 px-3 py-1 text-sm font-medium rounded-full border transition-colors flex items-center gap-1 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-cyan-900/50 text-cyan-400 border-cyan-700 hover:bg-cyan-800/70";
        btnEl.title = 'Berhenti ikuti tag pencarian ini';
        btnEl.innerHTML = `<svg class="w-4 h-4 btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span class="btn-text">Diikuti</span>`;
      } else {
        window.showToast(errorMessage || "Tag sudah diikuti.", "error");
        btnEl.disabled = false;
        btnEl.innerHTML = originalHtml;
      }
    }
  } catch (error) {
    console.error(error);
    window.showToast("Terjadi kesalahan jaringan.", "error");
    btnEl.disabled = false;
    btnEl.innerHTML = originalHtml;
  }
};
