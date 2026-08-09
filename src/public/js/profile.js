      // Tab logic
      const btnKoleksi = document.getElementById('tab-koleksi-btn');
      const btnMengikuti = document.getElementById('tab-mengikuti-btn');
      const contentKoleksi = document.getElementById('tab-koleksi-content');
      const contentMengikuti = document.getElementById('tab-mengikuti-content');

      if (btnKoleksi && btnMengikuti) {
        btnKoleksi.addEventListener('click', () => {
          contentKoleksi.classList.remove('hidden');
          contentMengikuti.classList.add('hidden');
          btnKoleksi.className = "py-3 px-6 text-cyan-400 border-b-2 border-cyan-400 font-bold focus:outline-none transition-colors";
          btnMengikuti.className = "py-3 px-6 text-gray-400 hover:text-white font-bold focus:outline-none transition-colors";
        });

        btnMengikuti.addEventListener('click', () => {
          contentMengikuti.classList.remove('hidden');
          contentKoleksi.classList.add('hidden');
          btnMengikuti.className = "py-3 px-6 text-cyan-400 border-b-2 border-cyan-400 font-bold focus:outline-none transition-colors";
          btnKoleksi.className = "py-3 px-6 text-gray-400 hover:text-white font-bold focus:outline-none transition-colors";
        });
      }

      // View toggle logic
      document.addEventListener('click', (e) => {
        const btnMasonry = e.target.closest('#view-masonry-btn');
        if (btnMasonry) {
          const viewMasonry = document.getElementById('koleksi-masonry');
          const viewData = document.getElementById('koleksi-data');
          const btnData = document.getElementById('view-data-btn');
          if (viewMasonry && viewData && btnData) {
            viewMasonry.classList.remove('hidden');
            viewData.classList.add('hidden');
            btnMasonry.classList.replace('bg-gray-700', 'bg-cyan-600');
            btnMasonry.classList.replace('text-gray-400', 'text-white');
            btnData.classList.replace('bg-cyan-600', 'bg-gray-700');
            btnData.classList.replace('text-white', 'text-gray-400');
          }
        }

        const btnData = e.target.closest('#view-data-btn');
        if (btnData) {
          const viewMasonry = document.getElementById('koleksi-masonry');
          const viewData = document.getElementById('koleksi-data');
          const btnMasonry = document.getElementById('view-masonry-btn');
          if (viewMasonry && viewData && btnMasonry) {
            viewData.classList.remove('hidden');
            viewMasonry.classList.add('hidden');
            btnData.classList.replace('bg-gray-700', 'bg-cyan-600');
            btnData.classList.replace('text-white', 'text-gray-400');
            btnMasonry.classList.replace('bg-cyan-600', 'bg-gray-700');
            btnMasonry.classList.replace('text-white', 'text-gray-400');
          }
        }
      });

      // Remove logic
      let itemToRemove = null;

      function removeSaveConfirm(postId, btnEl) {
        itemToRemove = {
          postId,
          btnEl
        };
        if (typeof window.showAlert === 'function') {
          window.showAlert("Hapus Koleksi", "Apakah Anda yakin ingin menghapus konten ini dari koleksi?", confirmRemove);
        } else {
          if (confirm("Apakah Anda yakin ingin menghapus konten ini dari koleksi?")) {
            confirmRemove();
          }
        }
      }

      async function confirmRemove() {
        if (!itemToRemove) return;
        const {
          postId,
          btnEl
        } = itemToRemove;
        btnEl.disabled = true;
        try {
          const res = await fetch('/api/save/' + postId, {
            method: 'POST'
          });
          const data = await res.json();
          if (data.saved === false) {
            const card = btnEl.closest('.group');
            if (card) {
              card.style.transition = 'all 0.3s ease';
              card.style.opacity = '0';
              card.style.transform = 'scale(0.9)';
              setTimeout(() => card.remove(), 300);
            }
            if (typeof window.showToast === 'function') {
              window.showToast("Koleksi berhasil dihapus", "success");
            } else {
              alert("Koleksi berhasil dihapus");
            }
          }
        } catch (err) {
          console.error(err);
          btnEl.disabled = false;
        }
      }

      async function removeSave(postId, btnEl, skipConfirm = false) {
        if (!skipConfirm) {
          removeSaveConfirm(postId, btnEl);
          return;
        }
        removeSaveConfirm(postId, btnEl); 
      }

      window.removeSave = function(postId, btnEl, skipConfirm = false) {
        removeSaveConfirm(postId, btnEl);
      };

      let tagToUnfollow = null;

      async function confirmUnfollowTag() {
        if (!tagToUnfollow) return;
        const { tagName, tagType, btnEl } = tagToUnfollow;
        btnEl.disabled = true;
        try {
          const res = await fetch('/api/follow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tagName,
              tagType
            })
          });
          const data = await res.json();
          if (res.ok) {
            const tagContainer = btnEl.closest('div.bg-gray-800');
            if (tagContainer) {
              tagContainer.style.transition = 'all 0.3s ease';
              tagContainer.style.opacity = '0';
              tagContainer.style.transform = 'scale(0.9)';
              setTimeout(() => tagContainer.remove(), 300);
            }
            if (typeof window.showToast === 'function') {
              window.showToast(data.message || 'Berhasil unfollow tag.', 'success');
            } else {
              alert(data.message || 'Berhasil unfollow tag.');
            }

            const countEl = document.querySelector('#tab-mengikuti-btn');
            if (countEl) {
              let match = countEl.textContent.match(/\((\d+)\)/);
              if (match && match[1]) {
                const newCount = Math.max(0, parseInt(match[1]) - 1);
                countEl.textContent = `Mengikuti (${newCount})`;
              }
            }
          } else {
            throw new Error(data.error || 'Gagal berhenti mengikuti tag.');
          }
        } catch (err) {
          console.error(err);
          if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
          else alert(err.message);
          btnEl.disabled = false;
        }
      }

      function unfollowTag(tagName, tagType, btnEl) {
        tagToUnfollow = { tagName, tagType, btnEl };
        if (typeof window.showAlert === 'function') {
          window.showAlert("Unfollow Tag", `Apakah Anda yakin ingin berhenti mengikuti tag "${tagName}"?`, confirmUnfollowTag);
        } else {
          if (confirm(`Apakah Anda yakin ingin berhenti mengikuti tag "${tagName}"?`)) {
            confirmUnfollowTag();
          }
        }
      }

      // Infinite Scroll Logic
      let currentPage = 1;
      let isFetching = false;
      let hasMore = (document.getElementById("cytus-profile-config")?.dataset.hasMore === "true") || false;;
      let masonryContainer = document.getElementById('koleksi-masonry');
      let dataContainer = document.getElementById('koleksi-data');

      let currentSearch = document.getElementById("cytus-profile-config")?.dataset.currentSearch || "";;
      let currentRating = document.getElementById("cytus-profile-config")?.dataset.currentRating || "";;

      async function loadMoreSaves() {
        if (isFetching || !hasMore || document.getElementById('tab-koleksi-content').classList.contains('hidden')) return;

        isFetching = true;
        const loader = document.getElementById('koleksi-loader');
        masonryContainer = document.getElementById('koleksi-masonry');
        dataContainer = document.getElementById('koleksi-data');
        if (loader) loader.classList.remove('hidden');

        try {
          currentPage++;
          const res = await fetch(`/api/profil/saves?page=${currentPage}&search=${encodeURIComponent(currentSearch)}&rating=${encodeURIComponent(currentRating)}`);
          const saves = await res.json();

          if (saves.length === 0) {
            hasMore = false;
            if (loader) loader.classList.add('hidden');
            return;
          }

          let newMasonryElements = [];
          saves.forEach((save, index) => {
            const isVideo = (save.extension === 'mp4' || save.extension === 'webm');
            let currentItemCount = masonryContainer._masonryItems ? masonryContainer._masonryItems.length : masonryContainer.querySelectorAll('.gallery-item').length;
            let masonryItem = `
              <div class="relative z-0 group bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-md hover:shadow-cyan-900/30 transition-all duration-300 break-inside-avoid gallery-item cursor-pointer group-hover:z-10" data-post-url="/posts/${save.postId}" ${isVideo ? 'data-is-video="true"' : ''} data-video-url="${isVideo ? save.fileUrl : ''}">
                  <div class="absolute top-0 left-0 z-30 bg-black/50 text-white text-xs px-2 py-1 rounded-br-md pointer-events-none transition-opacity duration-300 group-hover:opacity-0 [.mobile-active_&]:opacity-0">
                    ${currentItemCount + index + 1}
                  </div>
                  ${isVideo && save.fileUrl ? `
                    <div class="media-container relative w-full pb-[100%] bg-black">
                      <img src="${save.imageUrl}" class="absolute inset-0 w-full h-full object-cover video-preview transition-transform duration-300 group-hover:scale-105" alt="Saved Post ${save.postId}" loading="lazy">
                      <video src="${save.fileUrl}" class="absolute inset-0 w-full h-full object-cover video-playback hidden" muted loop playsinline></video>
                      <div class="absolute top-2 left-2 bg-black/60 rounded-full p-1 video-indicator z-20">
                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>
                      </div>
                    </div>
                  ` : save.imageUrl ? `
                    <div class="media-container relative w-full h-auto bg-black">
                       <img src="${save.imageUrl}" class="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105" alt="Saved Post ${save.postId}" loading="lazy">
                    </div>
                  ` : `
                    <div class="media-container w-full aspect-[3/4] bg-gray-800 flex items-center justify-center p-4 text-center">
                      <span class="text-sm font-medium text-cyan-400 break-all">ID: ${save.postId}</span>
                    </div>
                  `}
                  <div class="overlay absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 flex flex-col justify-end text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                    <div class="overlay-content">
                      <h4 class="font-bold truncate text-sm">Post ID: ${save.postId}</h4>
                      <p class="text-xs text-gray-400">Score: ${save.score || 0}</p>
                      <div class="flex gap-2 mt-2">
                        <a href="/posts/${save.postId}" class="detail-button flex-grow bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-md transition-colors flex items-center justify-center shadow-sm" title="Lihat Detail">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </a>
                        <button onclick="removeSave('${save.postId}', this, false)" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-md transition-colors flex items-center justify-center shadow-sm" title="Hapus dari Koleksi">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                  </div>
              </div>
            `;
            if (masonryContainer && masonryContainer.appendMasonryItems) {
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = masonryItem.trim();
              newMasonryElements.push(tempDiv.firstElementChild);
            } else if (masonryContainer) {
              masonryContainer.insertAdjacentHTML('beforeend', masonryItem);
            }

            let sourceName = 'Source';
            if (save.source) {
              try {
                let url = new URL(save.source);
                let hostname = url.hostname.replace('www.', '');
                sourceName = hostname.split('.')[0];
              } catch (e) {}
            }

            let dataItem = `
              <div class="flex flex-col sm:flex-row bg-gray-900 border border-gray-700 rounded-lg overflow-hidden group hover:shadow-cyan-900/20 transition-all">
                <a href="/posts/${save.postId}" class="flex-grow flex flex-col sm:flex-row hover:bg-gray-800/50 transition-colors">
                  <div class="w-full h-48 sm:w-28 sm:h-28 flex-shrink-0 relative bg-gray-800">
                    ${save.imageUrl ? `
                      <img src="${save.imageUrl}" class="w-full h-full object-cover transition-opacity" style="object-position: top" alt="Saved Post ${save.postId}" loading="lazy">
                    ` : `
                      <div class="w-full h-full flex items-center justify-center p-2 text-center">
                        <span class="text-xs font-medium text-cyan-400 break-all">ID: ${save.postId}</span>
                      </div>
                    `}
                  </div>
                  <div class="p-4 flex flex-col justify-center">
                    <div class="font-bold text-white mb-2">Post ID: ${save.postId}</div>
                    <div class="flex flex-wrap gap-2 text-xs">
                      <div class="bg-gray-800 border border-gray-700 px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                        <span class="text-gray-400 font-medium">Ext:</span>
                        <span class="font-bold text-cyan-400">${(save.fileUrl || save.imageUrl || 'unk.unk').split('.').pop().toUpperCase()}</span>
                      </div>
                      <div class="bg-gray-800 border border-gray-700 px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                        <span class="text-gray-400 font-medium">Rating:</span>
                        <span class="font-bold text-white">${save.rating ? save.rating.toUpperCase() : 'N/A'}</span>
                      </div>
                      <div class="bg-gray-800 border border-gray-700 px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                        <span class="text-gray-400 font-medium">Score:</span>
                        <span class="font-bold text-green-400">${save.score || 0}</span>
                      </div>
                      <div class="bg-gray-800 border border-gray-700 px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                        <span class="text-gray-400 font-medium">Size:</span>
                        <span class="font-bold text-white">${save.size ? (save.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</span>
                      </div>
                      <div class="bg-gray-800 border border-gray-700 px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                        <span class="text-gray-400 font-medium">Up:</span>
                        <span class="font-bold text-white">${save.uploadedAt ? new Date(save.uploadedAt).toLocaleDateString('id-ID') : 'N/A'}</span>
                      </div>
                      <div class="bg-gray-800 border border-gray-700 px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                        <span class="text-gray-400 font-medium">Save:</span>
                        <span class="font-bold text-white">${save.savedAt ? new Date(save.savedAt).toLocaleDateString('id-ID') : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </a>
                <div class="p-4 flex flex-col sm:border-l border-t sm:border-t-0 border-gray-700 bg-gray-900 shrink-0 sm:w-48">
                  <div class="w-full mt-auto flex flex-col gap-2">
                    ${save.source ? `
                      <a href="${save.source}" target="_blank" class="w-full justify-center text-sm bg-gray-700 hover:bg-gray-600 text-cyan-300 font-bold px-4 py-2 rounded transition-colors capitalize flex items-center gap-1 shadow-sm overflow-hidden">
                        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        <span class="truncate">Source: ${sourceName}</span>
                      </a>
                    ` : ''}
                    <div class="flex gap-2 w-full">
                      ${save.fileUrl ? `
                        <button onclick="forceDownload('${save.fileUrl}', 'CytusGallery_${save.postId}', this)" class="flex-grow justify-center text-sm bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-3 py-2 rounded transition-colors flex items-center gap-1 shadow-sm text-center" title="Download">
                          <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                      ` : ''}
                      <button onclick="removeSave('${save.postId}', this, false)" class="flex-grow justify-center text-sm bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded transition-colors flex items-center gap-1 shadow-sm" title="Hapus">
                        <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            `;
            if (dataContainer) dataContainer.insertAdjacentHTML('beforeend', dataItem);
          });

          if (newMasonryElements.length > 0 && masonryContainer && masonryContainer.appendMasonryItems) {
            masonryContainer.appendMasonryItems(newMasonryElements);
          }

          if (saves.length < 25) {
            hasMore = false;
          }
        } catch (err) {
          console.error(err);
        } finally {
          isFetching = false;
          if (loader) {
            if (!hasMore) {
              loader.innerHTML = '<p class="text-sm text-gray-500">Semua koleksi telah dimuat.</p>';
            } else {
              loader.classList.add('hidden');
            }
          }
        }
      }

      window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
          loadMoreSaves();
        }
      });

      // Debounce and Auto-lowercase untuk Filter Tag Koleksi
      let filterSearchTimeout;
      
      const performProfilSearch = async (profilForm) => {
         const koleksiResults = document.getElementById('koleksi-results');
         const url = new URL(profilForm.action || window.location.href);
         const formData = new FormData(profilForm);
         for(let [k,v] of formData.entries()) {
            if(v) url.searchParams.set(k, v);
         }
         if (koleksiResults) {
           koleksiResults.innerHTML = '<div class="w-full flex justify-center py-12"><div class="w-8 h-8 border-4 border-t-cyan-500 border-gray-600 rounded-full animate-spin"></div></div>';
         }
         try {
            const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            const text = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const newContent = doc.getElementById('koleksi-results');
            if (newContent && koleksiResults) {
               // [Fix #4] Simpan state tampilan (masonry/data) sebelum konten diganti
               const isDataViewActive = (() => {
                 const data = document.getElementById('koleksi-data');
                 const masonry = document.getElementById('koleksi-masonry');
                 if (!data || !masonry) return false;
                 return !data.classList.contains('hidden') && masonry.classList.contains('hidden');
               })();

               koleksiResults.innerHTML = newContent.innerHTML;
               window.history.replaceState({}, '', url.toString());
               currentPage = 1;
               hasMore = true;
               isFetching = false;
               currentSearch = document.getElementById('koleksi-search-input') ? document.getElementById('koleksi-search-input').value : '';
               const ratingSelect = profilForm.querySelector('select[name="rating"]');
               currentRating = ratingSelect ? ratingSelect.value : '';
              
               // [Fix #2] Tidak memanggil .focus() agar keyboard mobile tidak muncul kembali
              
               if (typeof window.initializeMasonry === 'function') {
                 window.initializeMasonry();
               }
              
               // [Fix #4] Kembalikan state tampilan setelah konten diganti
               if (isDataViewActive) {
                 const viewMasonry = document.getElementById('koleksi-masonry');
                 const viewData = document.getElementById('koleksi-data');
                 const btnMasonry = document.getElementById('view-masonry-btn');
                 const btnData = document.getElementById('view-data-btn');
                 if (viewMasonry) viewMasonry.classList.add('hidden');
                 if (viewData) viewData.classList.remove('hidden');
                 if (btnMasonry) {
                   btnMasonry.classList.replace('bg-cyan-600', 'bg-gray-700');
                   btnMasonry.classList.replace('text-white', 'text-gray-400');
                 }
                 if (btnData) {
                   btnData.classList.replace('bg-gray-700', 'bg-cyan-600');
                   btnData.classList.replace('text-gray-400', 'text-white');
                 }
               }

               // Update jumlah koleksi di tab
               const newTabBtn = doc.getElementById('tab-koleksi-btn');
               const tabBtn = document.getElementById('tab-koleksi-btn');
               if (newTabBtn && tabBtn) {
                 tabBtn.textContent = newTabBtn.textContent;
               }
             }
         } catch(err) {
            profilForm.submit();
         }
      };

      document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'koleksi-search-input') {
          const profilForm = document.getElementById('profil-form');
          if (!profilForm) return;

          const start = e.target.selectionStart;
          const end = e.target.selectionEnd;
          e.target.value = e.target.value.toLowerCase();
          e.target.setSelectionRange(start, end);

          clearTimeout(filterSearchTimeout);
          filterSearchTimeout = setTimeout(() => performProfilSearch(profilForm), 500);
        }
      });
      
      document.addEventListener('change', (e) => {
        if (e.target && e.target.name === 'rating' && e.target.closest('#profil-form')) {
          const profilForm = document.getElementById('profil-form');
          if (!profilForm) return;
          performProfilSearch(profilForm);
        }
      });
      
      const pForm = document.getElementById('profil-form');
      if (pForm) {
        pForm.addEventListener('submit', (e) => {
          e.preventDefault();
          performProfilSearch(pForm);
        });
      }

      // Batch Action Logic
      let isSelectionMode = false;
      const selectedItems = new Set();
      
      function updateBatchActionBar() {
        const batchActionBar = document.getElementById('batch-action-bar');
        const selectedCountEl = document.getElementById('selected-count');
        const selectModeBtn = document.getElementById('select-mode-btn');
        if (isSelectionMode) {
          if (selectModeBtn) {
            selectModeBtn.classList.replace('bg-gray-700', 'bg-cyan-600');
            selectModeBtn.classList.replace('text-gray-400', 'text-white');
          }
          if (batchActionBar) batchActionBar.style.transform = 'translateY(0)';
          if (selectedCountEl) selectedCountEl.textContent = selectedItems.size;
        } else {
          if (selectModeBtn) {
            selectModeBtn.classList.replace('bg-cyan-600', 'bg-gray-700');
            selectModeBtn.classList.replace('text-white', 'text-gray-400');
          }
          if (batchActionBar) batchActionBar.style.transform = 'translateY(100%)';
          selectedItems.clear();
          document.querySelectorAll('.gallery-item').forEach(el => {
            el.classList.remove('selected-item');
          });
        }
      }

      document.addEventListener('click', (e) => {
        const selectModeBtn = e.target.closest('#select-mode-btn');
        if (selectModeBtn) {
          isSelectionMode = !isSelectionMode;
          updateBatchActionBar();
        }
      });

      const batchCancelBtn = document.getElementById('batch-cancel-btn');
      if (batchCancelBtn) {
        batchCancelBtn.addEventListener('click', () => {
          isSelectionMode = false;
          updateBatchActionBar();
        });
      }
      
      const batchSelectAllBtn = document.getElementById('batch-select-all-btn');
      if (batchSelectAllBtn) {
        batchSelectAllBtn.addEventListener('click', () => {
          const allItems = document.querySelectorAll('.gallery-item');
          if (selectedItems.size === allItems.length && allItems.length > 0) {
            // Deselect all
            selectedItems.clear();
            allItems.forEach(el => el.classList.remove('selected-item'));
          } else {
            // Select all
            allItems.forEach(el => {
              const postId = el.dataset.postId || el.getAttribute('data-post-url').split('/').pop();
              if (postId) {
                selectedItems.add(postId);
                el.classList.add('selected-item');
              }
            });
          }
          updateBatchActionBar();
        });
      }

      // Handle item click for Selection Mode (Capture phase to override default nav)
      document.addEventListener('click', function(e) {
        if (!isSelectionMode || window._downloadInProgress) return;
        const item = e.target.closest('.gallery-item');
        if (!item) return;

        // In selection mode, block default navigation
        e.preventDefault();
        e.stopPropagation();

        if (e.target.closest('button')) {
          if (e.target.closest('#batch-action-bar')) return;
        }

        const postId = item.dataset.postId || item.getAttribute('data-post-url').split('/').pop();
        if (!postId) return;
        
        if (selectedItems.has(postId)) {
          selectedItems.delete(postId);
          document.querySelectorAll('.gallery-item[data-post-url="/posts/' + postId + '"]').forEach(el => {
            el.classList.remove('selected-item');
          });
        } else {
          selectedItems.add(postId);
          document.querySelectorAll('.gallery-item[data-post-url="/posts/' + postId + '"]').forEach(el => {
            el.classList.add('selected-item');
          });
        }
        const countEl = document.getElementById('selected-count');
        if (countEl) countEl.textContent = selectedItems.size;
      }, true);
      
      const batchDeleteBtn = document.getElementById('batch-delete-btn');
      if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', () => {
          if (selectedItems.size === 0) return;
          if (typeof window.showAlert === 'function') {
            window.showAlert("Konfirmasi Hapus", `Hapus ${selectedItems.size} konten dari koleksi?`, async () => {
              await processBatchDelete();
            });
            const confirmBtn = document.getElementById("custom-alert-confirm");
            if (confirmBtn) confirmBtn.textContent = "Hapus";
          } else {
            if (confirm(`Hapus ${selectedItems.size} konten dari koleksi?`)) processBatchDelete();
          }
          
          async function processBatchDelete() {
            batchDeleteBtn.disabled = true;
            batchDeleteBtn.innerHTML = '<svg class="w-5 h-5 animate-spin mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            try {
              const res = await fetch('/api/collections/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postIds: Array.from(selectedItems) })
              });
              const data = await res.json();
              if (data.success) {
                selectedItems.forEach(postId => {
                  document.querySelectorAll('.gallery-item[data-post-url="/posts/' + postId + '"]').forEach(el => {
                    if (el.parentNode) el.parentNode.removeChild(el);
                  });
                });
                isSelectionMode = false;
                updateBatchActionBar();
                if (typeof window.showToast === 'function') window.showToast("Berhasil menghapus.", "success");
              } else {
                throw new Error(data.error);
              }
            } catch(e) {
              if (typeof window.showAlert === 'function') {
                window.showAlert("Error", e.message || "Gagal menghapus batch.");
              } else {
                alert(e.message || "Gagal menghapus batch.");
              }
            } finally {
              batchDeleteBtn.disabled = false;
              batchDeleteBtn.innerHTML = '<svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
            }
          }
        });
      }
      
      const batchDownloadBtn = document.getElementById('batch-download-btn');
      if (batchDownloadBtn) {
        batchDownloadBtn.addEventListener('click', () => {
          if (selectedItems.size === 0) return;
          if (typeof window.showAlert === 'function') {
            window.showAlert("Konfirmasi Unduhan", `Unduh ${selectedItems.size} konten yang dipilih dalam format ZIP?`, async () => {
              await processBatchDownload();
            });
            const confirmBtn = document.getElementById("custom-alert-confirm");
            if (confirmBtn) confirmBtn.textContent = "Unduh";
          } else {
            if (confirm(`Unduh ${selectedItems.size} konten yang dipilih dalam format ZIP?`)) processBatchDownload();
          }

          async function processBatchDownload() {
            let downloadCancelled = false;
            
            const delBtn = document.getElementById('batch-delete-btn');
            const selAllBtn = document.getElementById('batch-select-all-btn');
            const cancelBtn = document.getElementById('batch-cancel-btn');
            if (delBtn) delBtn.disabled = true;
            if (selAllBtn) selAllBtn.disabled = true;
            batchDownloadBtn.disabled = true;
            batchDownloadBtn.innerHTML = '<svg class="w-5 h-5 animate-spin mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            window._downloadInProgress = true;
            
            const cancelHandler = (e) => {
              e.stopPropagation();
              if (typeof window.showAlert === 'function') {
                window.showAlert("Batalkan Unduhan", "Apakah Anda yakin ingin membatalkan unduhan?", () => {
                  downloadCancelled = true;
                });
                const cBtn = document.getElementById("custom-alert-confirm");
                if (cBtn) cBtn.textContent = "Ya, Batalkan";
              } else {
                if (confirm("Batalkan unduhan?")) {
                  downloadCancelled = true;
                }
              }
            };
            if (cancelBtn) cancelBtn.addEventListener('click', cancelHandler);
            
            try {
              if (typeof JSZip === 'undefined') {
                throw new Error("Library ZIP belum termuat, mohon periksa koneksi internet.");
              }
              const response = await fetch('/api/collections/batch-download-urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postIds: Array.from(selectedItems) })
              });
              if (!response.ok) throw new Error("Gagal mengambil daftar unduhan dari server.");
              
              const { urls } = await response.json();
              if (!urls || urls.length === 0) throw new Error("Tidak ada file valid yang bisa diunduh.");

              const zip = new JSZip();
              let successCount = 0;
              let failCount = 0;
              const total = urls.length;
              
              for (let i = 0; i < total; i++) {
                if (downloadCancelled) throw new Error("Dibatalkan");
                const item = urls[i];
                const pct = Math.round(((i + 1) / total) * 100); batchDownloadBtn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span class="ml-1 text-sm font-bold">${pct}%</span>`;
                try {
                  const imgRes = await fetch(item.url);
                  if (!imgRes.ok) throw new Error("HTTP " + imgRes.status);
                  const blob = await imgRes.blob();
                  zip.file(item.filename, blob);
                  successCount++;
                } catch (err) {
                  console.error("Gagal unduh " + item.url, err);
                  failCount++;
                }
              }
              
              if (downloadCancelled) throw new Error("Dibatalkan");
              
              batchDownloadBtn.innerHTML = '<svg class="w-5 h-5 animate-pulse mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
              const zipBlob = await zip.generateAsync({ type: "blob" });
              
              if (downloadCancelled) throw new Error("Dibatalkan");
              
              if (typeof saveAs !== 'undefined') {
                 saveAs(zipBlob, `CytusGallery_Batch_${Date.now()}.zip`);
              } else {
                 const url = window.URL.createObjectURL(zipBlob);
                 const a = document.createElement('a');
                 a.style.display = 'none';
                 a.href = url;
                 a.download = `CytusGallery_Batch_${Date.now()}.zip`;
                 document.body.appendChild(a);
                 a.click();
                 window.URL.revokeObjectURL(url);
              }
              
              if (failCount > 0) {
                 if (typeof window.showToast === 'function') window.showToast(`Selesai dengan ${failCount} gagal.`, 'info');
              } else {
                 if (typeof window.showToast === 'function') window.showToast("Berhasil diunduh!", 'success');
              }
              
              isSelectionMode = false;
              updateBatchActionBar();
              
            } catch(e) {
              if (downloadCancelled || e.message === "Dibatalkan") {
                if (typeof window.showToast === 'function') window.showToast("Unduhan dibatalkan.", "info");
              } else {
                if (typeof window.showAlert === 'function') {
                  window.showAlert("Error", e.message || "Gagal mengunduh batch.");
                } else {
                  alert(e.message || "Gagal mengunduh.");
                }
              }
            } finally {
              window._downloadInProgress = false;
              batchDownloadBtn.disabled = false;
              batchDownloadBtn.innerHTML = '<svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>';
              if (delBtn) delBtn.disabled = false;
              if (selAllBtn) selAllBtn.disabled = false;
              if (cancelBtn) cancelBtn.removeEventListener('click', cancelHandler);
            }
          }
        });
      }
