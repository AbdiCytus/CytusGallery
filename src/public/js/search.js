  window.toggleTimeFilter = function() {
    const isEnabled = document.getElementById('enable-time-filter').checked;
    const content = document.getElementById('time-filter-content');
    if(isEnabled) {
       content.classList.remove('opacity-50', 'pointer-events-none');
    } else {
       content.classList.add('opacity-50', 'pointer-events-none');
    }
  }

  window.switchTimeTab = function(mode) {
    document.getElementById('time-mode').value = mode;
    const btnSpec = document.getElementById('tab-btn-spesifik');
    const btnRange = document.getElementById('tab-btn-rentang');
    const tabSpec = document.getElementById('tab-spesifik');
    const tabRange = document.getElementById('tab-rentang');
    
    if(mode === 'spesifik') {
       btnSpec.classList.add('bg-gray-700', 'text-white', 'shadow-sm');
       btnSpec.classList.remove('text-gray-400');
       btnRange.classList.remove('bg-gray-700', 'text-white', 'shadow-sm');
       btnRange.classList.add('text-gray-400');
       
       tabSpec.classList.remove('hidden');
       tabRange.classList.add('hidden');
    } else {
       btnRange.classList.add('bg-gray-700', 'text-white', 'shadow-sm');
       btnRange.classList.remove('text-gray-400');
       btnSpec.classList.remove('bg-gray-700', 'text-white', 'shadow-sm');
       btnSpec.classList.add('text-gray-400');
       
       tabRange.classList.remove('hidden');
       tabSpec.classList.add('hidden');
    }
  }

  window.toggleMobileAccordion = function(section) {
    const tagsContent = document.getElementById('accordion-content-tags');
    const timeContent = document.getElementById('accordion-content-time');
    const tagsIcon = document.getElementById('accordion-icon-tags');
    const timeIcon = document.getElementById('accordion-icon-time');
    
    // Toggle state: If screen is mobile (md breakpoint = 768px), allow toggle
    if (window.innerWidth < 768) {
      if (section === 'tags') {
         tagsContent.classList.remove('hidden');
         tagsContent.classList.add('flex');
         tagsIcon.classList.remove('-rotate-90');
         
         timeContent.classList.add('hidden');
         timeContent.classList.remove('flex');
         timeIcon.classList.add('-rotate-90');
      } else {
         timeContent.classList.remove('hidden');
         timeContent.classList.add('flex');
         timeIcon.classList.remove('-rotate-90');
         
         tagsContent.classList.add('hidden');
         tagsContent.classList.remove('flex');
         tagsIcon.classList.add('-rotate-90');
      }
    }
  };

  window.validateTimeInputs = function(prefix) {
    const y = document.getElementById(`${prefix}-year`);
    const m = document.getElementById(`${prefix}-month`);
    const d = document.getElementById(`${prefix}-day`);
    
    if (y.value) {
       m.disabled = false;
       m.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
       m.disabled = true;
       m.value = "";
       m.classList.add('opacity-50', 'cursor-not-allowed');
    }
    
    if (y.value && m.value) {
       d.disabled = false;
       d.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
       d.disabled = true;
       d.value = "";
       d.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  window.openFollowedTagsModal = function() {
    document.getElementById('filter-error-msg').classList.add('hidden');
    if (typeof window.hideLoader === 'function') window.hideLoader();
    const modal = document.getElementById('followed-tags-modal');
    if (!modal) return;
    
    const savedFilter = localStorage.getItem('cytusGalleryFollowedTagsFilter');
    let checkedTags = [];
    if (savedFilter !== null) checkedTags = JSON.parse(savedFilter);
    
    document.querySelectorAll('.followed-tag-filter').forEach(cb => {
      cb.checked = checkedTags.includes(cb.value);
    });

    // Angkat tag yang dicentang ke urutan paling atas
    const tagContainer = document.getElementById('followed-tags-checkboxes');
    if (tagContainer) {
      const labels = Array.from(tagContainer.children);
      labels.sort((a, b) => {
        const cbA = a.querySelector('.followed-tag-filter');
        const cbB = b.querySelector('.followed-tag-filter');
        const isCheckedA = cbA && cbA.checked ? 1 : 0;
        const isCheckedB = cbB && cbB.checked ? 1 : 0;
        return isCheckedB - isCheckedA;
      });
      labels.forEach(label => tagContainer.appendChild(label));
    }

    const savedDateFilter = localStorage.getItem('cytusGalleryFollowedDateFilter');
    if (savedDateFilter) {
       const d = JSON.parse(savedDateFilter);
       document.getElementById('enable-time-filter').checked = d.enabled;
       switchTimeTab(d.mode || 'spesifik');
       
       document.getElementById('spec-year').value = d.specYear || "";
       document.getElementById('spec-month').value = d.specMonth || "";
       document.getElementById('spec-day').value = d.specDay || "";
       
       document.getElementById('range-start-year').value = d.rsYear || "";
       document.getElementById('range-start-month').value = d.rsMonth || "";
       document.getElementById('range-start-day').value = d.rsDay || "";
       
       document.getElementById('range-end-year').value = d.reYear || "";
       document.getElementById('range-end-month').value = d.reMonth || "";
       document.getElementById('range-end-day').value = d.reDay || "";
       
       validateTimeInputs('spec');
       validateTimeInputs('range-start');
       validateTimeInputs('range-end');
    } else {
       document.getElementById('enable-time-filter').checked = false;
       switchTimeTab('spesifik');
       
       document.getElementById('spec-year').value = "";
       document.getElementById('spec-month').value = "";
       document.getElementById('spec-day').value = "";
       
       document.getElementById('range-start-year').value = "";
       document.getElementById('range-start-month').value = "";
       document.getElementById('range-start-day').value = "";
       
       document.getElementById('range-end-year').value = "";
       document.getElementById('range-end-month').value = "";
       document.getElementById('range-end-day').value = "";
       
       validateTimeInputs('spec');
       validateTimeInputs('range-start');
       validateTimeInputs('range-end');
    }
    toggleTimeFilter();
    
    modal.classList.remove('hidden');
  };

  window.resetFollowedTagsFilter = function() {
    document.getElementById('filter-error-msg').classList.add('hidden');
    document.querySelectorAll('.followed-tag-filter').forEach(cb => cb.checked = false);
    document.getElementById('enable-time-filter').checked = false;
    
    document.getElementById('spec-year').value = "";
    document.getElementById('spec-month').value = "";
    document.getElementById('spec-day').value = "";
    
    document.getElementById('range-start-year').value = "";
    document.getElementById('range-start-month').value = "";
    document.getElementById('range-start-day').value = "";
    
    document.getElementById('range-end-year').value = "";
    document.getElementById('range-end-month').value = "";
    document.getElementById('range-end-day').value = "";
    
    validateTimeInputs('spec');
    validateTimeInputs('range-start');
    validateTimeInputs('range-end');
    
    switchTimeTab('spesifik');
    toggleTimeFilter();
  };

  window.applyFollowedTagsFilter = function() {
    const checkedTags = Array.from(document.querySelectorAll('.followed-tag-filter'))
                             .filter(cb => cb.checked)
                             .map(cb => cb.value);
    const totalTags = document.querySelectorAll('.followed-tag-filter').length;
    
    if (checkedTags.length === 0 || checkedTags.length === totalTags) {
      localStorage.removeItem('cytusGalleryFollowedTagsFilter');
    } else {
      localStorage.setItem('cytusGalleryFollowedTagsFilter', JSON.stringify(checkedTags));
    }

    let dateFilter = "";
    const isTimeEnabled = document.getElementById('enable-time-filter').checked;
    const mode = document.getElementById('time-mode').value;
    
    let specYear = document.getElementById('spec-year').value;
    let specMonth = document.getElementById('spec-month').value;
    let specDay = document.getElementById('spec-day').value;
    
    let rsYear = document.getElementById('range-start-year').value;
    let rsMonth = document.getElementById('range-start-month').value;
    let rsDay = document.getElementById('range-start-day').value;
    
    let reYear = document.getElementById('range-end-year').value;
    let reMonth = document.getElementById('range-end-month').value;
    let reDay = document.getElementById('range-end-day').value;

    if (isTimeEnabled) {
       document.getElementById('filter-error-msg').classList.add('hidden');
       
       if (mode === 'rentang' && (!rsYear || !reYear)) {
          document.getElementById('filter-error-msg').classList.remove('hidden');
          document.getElementById('filter-error-text').innerText = "Silakan isi minimal Tahun pada Tanggal Mulai dan Tanggal Selesai.";
          return;
       }
       if (mode === 'spesifik' && !specYear) {
          document.getElementById('filter-error-msg').classList.remove('hidden');
          document.getElementById('filter-error-text').innerText = "Silakan isi minimal Tahun untuk menggunakan mode Spesifik.";
          return;
       }

       localStorage.setItem('cytusGalleryFollowedDateFilter', JSON.stringify({
          enabled: true, mode, specYear, specMonth, specDay, rsYear, rsMonth, rsDay, reYear, reMonth, reDay
       }));
       
       if (mode === 'spesifik') {
          if (specMonth && specDay) {
             let m = specMonth.padStart(2, '0');
             let d = specDay.padStart(2, '0');
             dateFilter = `date:${specYear}-${m}-${d}`;
          } else if (specMonth) {
             let m = specMonth.padStart(2, '0');
             let lastDay = new Date(specYear, parseInt(m), 0).getDate();
             dateFilter = `date:${specYear}-${m}-01..${specYear}-${m}-${lastDay}`;
          } else {
             dateFilter = `date:${specYear}-01-01..${specYear}-12-31`;
          }
       } else {
          // Range mode building
          let rangeStartStr = "";
          if (rsMonth && rsDay) {
             rangeStartStr = `${rsYear}-${rsMonth.padStart(2, '0')}-${rsDay.padStart(2, '0')}`;
          } else if (rsMonth) {
             rangeStartStr = `${rsYear}-${rsMonth.padStart(2, '0')}-01`;
          } else {
             rangeStartStr = `${rsYear}-01-01`;
          }

          let rangeEndStr = "";
          if (reMonth && reDay) {
             rangeEndStr = `${reYear}-${reMonth.padStart(2, '0')}-${reDay.padStart(2, '0')}`;
          } else if (reMonth) {
             let m = reMonth.padStart(2, '0');
             let lastDay = new Date(reYear, parseInt(m), 0).getDate();
             rangeEndStr = `${reYear}-${m}-${lastDay}`;
          } else {
             rangeEndStr = `${reYear}-12-31`;
          }
          
          dateFilter = `date:${rangeStartStr}..${rangeEndStr}`;
       }
    } else {
       localStorage.removeItem('cytusGalleryFollowedDateFilter');
    }
    
    document.getElementById('followed-tags-modal').classList.add('hidden');
    
    const currentUrl = new URL(window.location.href);
    if (checkedTags.length > 0 && checkedTags.length !== totalTags) {
       currentUrl.searchParams.set("followedTags", checkedTags.join(","));
    } else {
       currentUrl.searchParams.delete("followedTags");
    }
    
    let existingQuery = currentUrl.searchParams.get("query") || "";
    existingQuery = existingQuery.replace(/date:[^\s]+/g, '').trim(); 
    if (dateFilter) {
       existingQuery = (existingQuery + " " + dateFilter).trim();
    }
    if (existingQuery) {
       currentUrl.searchParams.set("query", existingQuery);
    } else {
       currentUrl.searchParams.delete("query");
    }
    
    if (typeof window.showLoader === 'function') window.showLoader("Memuat Konten...");
    window.location.href = currentUrl.toString();
  };

  window.updateFollowedTabVisuals = function() {
    const hasDateFilterStr = localStorage.getItem('cytusGalleryFollowedDateFilter');
    const hasTagsFilterStr = localStorage.getItem('cytusGalleryFollowedTagsFilter');
    let isActive = false;
    
    if (hasTagsFilterStr) {
       const t = JSON.parse(hasTagsFilterStr);
       if (t && t.length > 0) isActive = true;
    }
    if (hasDateFilterStr) {
       const d = JSON.parse(hasDateFilterStr);
       if (d && d.enabled) isActive = true;
    }
    
    const followedTab = document.querySelector('a[data-tab="followed"]');
    
    if (followedTab) {
      const urlParams = new URLSearchParams(window.location.search);
      const currentTab = urlParams.get('tab') || 'contents';
      const isCurrentTab = currentTab === 'followed' || followedTab.classList.contains("text-white");
      
      if (isActive && isCurrentTab) {
         followedTab.classList.remove('text-white', 'text-gray-500');
         followedTab.classList.add('!text-cyan-400', 'drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]');
      } else {
         followedTab.classList.remove('!text-cyan-400', 'drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]');
         if (isCurrentTab) {
            followedTab.classList.add('text-white');
            followedTab.classList.remove('text-gray-500');
         } else {
            followedTab.classList.add('text-gray-500');
            followedTab.classList.remove('text-white');
         }
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.updateFollowedTabVisuals();
  });

  // --- Collection Filter Logic ---
  window.toggleTimeFilterCollection = function() {
    const isEnabled = document.getElementById('c-enable-time-filter').checked;
    const content = document.getElementById('c-time-filter-content');
    if(isEnabled) {
       content.classList.remove('opacity-50', 'pointer-events-none');
    } else {
       content.classList.add('opacity-50', 'pointer-events-none');
    }
  }

  window.switchTimeTabCollection = function(mode) {
    document.getElementById('c-time-mode').value = mode;
    const btnSpec = document.getElementById('c-tab-btn-spesifik');
    const btnRange = document.getElementById('c-tab-btn-rentang');
    const tabSpec = document.getElementById('c-tab-spesifik');
    const tabRange = document.getElementById('c-tab-rentang');
    
    if(mode === 'spesifik') {
       btnSpec.classList.add('bg-gray-700', 'text-white', 'shadow-sm');
       btnSpec.classList.remove('text-gray-400');
       btnRange.classList.remove('bg-gray-700', 'text-white', 'shadow-sm');
       btnRange.classList.add('text-gray-400');
       
       tabSpec.classList.remove('hidden');
       tabRange.classList.add('hidden');
    } else {
       btnRange.classList.add('bg-gray-700', 'text-white', 'shadow-sm');
       btnRange.classList.remove('text-gray-400');
       btnSpec.classList.remove('bg-gray-700', 'text-white', 'shadow-sm');
       btnSpec.classList.add('text-gray-400');
       
       tabRange.classList.remove('hidden');
       tabSpec.classList.add('hidden');
    }
  }

  window.toggleMobileAccordionCollection = function(section) {
    const propsContent = document.getElementById('c-accordion-content-props');
    const timeContent = document.getElementById('c-accordion-content-time');
    const propsIcon = document.getElementById('c-accordion-icon-props');
    const timeIcon = document.getElementById('c-accordion-icon-time');
    
    if (window.innerWidth < 768) {
      if (section === 'properties') {
         propsContent.classList.remove('hidden');
         propsContent.classList.add('flex');
         propsIcon.classList.remove('-rotate-90');
         
         timeContent.classList.add('hidden');
         timeContent.classList.remove('flex');
         timeIcon.classList.add('-rotate-90');
      } else {
         timeContent.classList.remove('hidden');
         timeContent.classList.add('flex');
         timeIcon.classList.remove('-rotate-90');
         
         propsContent.classList.add('hidden');
         propsContent.classList.remove('flex');
         propsIcon.classList.add('-rotate-90');
      }
    }
  };

  window.validateTimeInputsCollection = function(prefix) {
    const y = document.getElementById(`${prefix}-year`);
    const m = document.getElementById(`${prefix}-month`);
    const d = document.getElementById(`${prefix}-day`);
    if (y.value) {
       m.disabled = false; m.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
       m.disabled = true; m.value = ""; m.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (y.value && m.value) {
       d.disabled = false; d.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
       d.disabled = true; d.value = ""; d.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  window.openCollectionFilterModal = function() {
    document.getElementById('c-filter-error-msg').classList.add('hidden');
    if (typeof window.hideLoader === 'function') window.hideLoader();
    const modal = document.getElementById('collection-filter-modal');
    if (!modal) return;
    
    const savedFilter = localStorage.getItem('cytusGalleryCollectionTagsFilter');
    let checkedTags = [];
    if (savedFilter !== null) checkedTags = JSON.parse(savedFilter);
    else checkedTags = []; // Default to all unchecked
    
    modal.querySelectorAll('.collection-tag-filter').forEach(cb => {
      cb.checked = checkedTags.includes(cb.value);
    });

    // Angkat tag yang dicentang ke urutan paling atas
    const tagContainer = document.getElementById('collection-tags-checkboxes');
    if (tagContainer) {
      const labels = Array.from(tagContainer.children);
      labels.sort((a, b) => {
        const cbA = a.querySelector('.collection-tag-filter');
        const cbB = b.querySelector('.collection-tag-filter');
        const isCheckedA = cbA && cbA.checked ? 1 : 0;
        const isCheckedB = cbB && cbB.checked ? 1 : 0;
        return isCheckedB - isCheckedA;
      });
      labels.forEach(label => tagContainer.appendChild(label));
    }

    const savedDateFilter = localStorage.getItem('cytusGalleryCollectionDateFilter');
    if (savedDateFilter) {
       const d = JSON.parse(savedDateFilter);
       document.getElementById('c-enable-time-filter').checked = d.enabled;
       switchTimeTabCollection(d.mode || 'spesifik');
       
       document.getElementById('c-spec-year').value = d.specYear || "";
       document.getElementById('c-spec-month').value = d.specMonth || "";
       document.getElementById('c-spec-day').value = d.specDay || "";
       
       document.getElementById('c-range-start-year').value = d.rsYear || "";
       document.getElementById('c-range-start-month').value = d.rsMonth || "";
       document.getElementById('c-range-start-day').value = d.rsDay || "";
       
       document.getElementById('c-range-end-year').value = d.reYear || "";
       document.getElementById('c-range-end-month').value = d.reMonth || "";
       document.getElementById('c-range-end-day').value = d.reDay || "";
       
       validateTimeInputsCollection('c-spec');
       validateTimeInputsCollection('c-range-start');
       validateTimeInputsCollection('c-range-end');
    } else {
       document.getElementById('c-enable-time-filter').checked = false;
       switchTimeTabCollection('spesifik');
       
       document.getElementById('c-spec-year').value = "";
       document.getElementById('c-spec-month').value = "";
       document.getElementById('c-spec-day').value = "";
       
       document.getElementById('c-range-start-year').value = "";
       document.getElementById('c-range-start-month').value = "";
       document.getElementById('c-range-start-day').value = "";
       
       document.getElementById('c-range-end-year').value = "";
       document.getElementById('c-range-end-month').value = "";
       document.getElementById('c-range-end-day').value = "";
       
       validateTimeInputsCollection('c-spec');
       validateTimeInputsCollection('c-range-start');
       validateTimeInputsCollection('c-range-end');
    }
    toggleTimeFilterCollection();
    
    modal.classList.remove('hidden');
  };

  window.resetCollectionFilter = function() {
    document.getElementById('c-filter-error-msg').classList.add('hidden');
    document.querySelectorAll('.collection-tag-filter').forEach(cb => cb.checked = false);
    document.getElementById('c-enable-time-filter').checked = false;
    
    document.getElementById('c-spec-year').value = "";
    document.getElementById('c-spec-month').value = "";
    document.getElementById('c-spec-day').value = "";
    
    document.getElementById('c-range-start-year').value = "";
    document.getElementById('c-range-start-month').value = "";
    document.getElementById('c-range-start-day').value = "";
    
    document.getElementById('c-range-end-year').value = "";
    document.getElementById('c-range-end-month').value = "";
    document.getElementById('c-range-end-day').value = "";
    
    validateTimeInputsCollection('c-spec');
    validateTimeInputsCollection('c-range-start');
    validateTimeInputsCollection('c-range-end');
    
    switchTimeTabCollection('spesifik');
    toggleTimeFilterCollection();
  };

  window.applyCollectionFilter = function() {
    const modal = document.getElementById('collection-filter-modal');
    const checkboxes = modal ? Array.from(modal.querySelectorAll('.collection-tag-filter')) : Array.from(document.querySelectorAll('.collection-tag-filter'));
    const checkedTags = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
    const totalTags = checkboxes.length;
    
    if (checkedTags.length === 0 || checkedTags.length === totalTags) {
      localStorage.removeItem('cytusGalleryCollectionTagsFilter');
    } else {
      localStorage.setItem('cytusGalleryCollectionTagsFilter', JSON.stringify(checkedTags));
    }

    let dateFilter = "";
    const isTimeEnabled = document.getElementById('c-enable-time-filter').checked;
    const mode = document.getElementById('c-time-mode').value;
    
    let specYear = document.getElementById('c-spec-year').value;
    let specMonth = document.getElementById('c-spec-month').value;
    let specDay = document.getElementById('c-spec-day').value;
    
    let rsYear = document.getElementById('c-range-start-year').value;
    let rsMonth = document.getElementById('c-range-start-month').value;
    let rsDay = document.getElementById('c-range-start-day').value;
    
    let reYear = document.getElementById('c-range-end-year').value;
    let reMonth = document.getElementById('c-range-end-month').value;
    let reDay = document.getElementById('c-range-end-day').value;

    if (isTimeEnabled) {
       document.getElementById('c-filter-error-msg').classList.add('hidden');
       
       if (mode === 'rentang' && (!rsYear || !reYear)) {
          document.getElementById('c-filter-error-msg').classList.remove('hidden');
          document.getElementById('c-filter-error-text').innerText = "Silakan isi minimal Tahun pada Tanggal Mulai dan Tanggal Selesai.";
          return;
       }
       if (mode === 'spesifik' && !specYear) {
          document.getElementById('c-filter-error-msg').classList.remove('hidden');
          document.getElementById('c-filter-error-text').innerText = "Silakan isi minimal Tahun untuk menggunakan mode Spesifik.";
          return;
       }

       localStorage.setItem('cytusGalleryCollectionDateFilter', JSON.stringify({
          enabled: true, mode, specYear, specMonth, specDay, rsYear, rsMonth, rsDay, reYear, reMonth, reDay
       }));
       
       if (mode === 'spesifik') {
          if (specMonth && specDay) {
             dateFilter = `date:${specYear}-${specMonth.padStart(2, '0')}-${specDay.padStart(2, '0')}`;
          } else if (specMonth) {
             let m = specMonth.padStart(2, '0');
             let lastDay = new Date(specYear, parseInt(m), 0).getDate();
             dateFilter = `date:${specYear}-${m}-01..${specYear}-${m}-${lastDay}`;
          } else {
             dateFilter = `date:${specYear}-01-01..${specYear}-12-31`;
          }
       } else {
          let rangeStartStr = "";
          if (rsMonth && rsDay) rangeStartStr = `${rsYear}-${rsMonth.padStart(2, '0')}-${rsDay.padStart(2, '0')}`;
          else if (rsMonth) rangeStartStr = `${rsYear}-${rsMonth.padStart(2, '0')}-01`;
          else rangeStartStr = `${rsYear}-01-01`;

          let rangeEndStr = "";
          if (reMonth && reDay) rangeEndStr = `${reYear}-${reMonth.padStart(2, '0')}-${reDay.padStart(2, '0')}`;
          else if (reMonth) {
             let lastDay = new Date(reYear, parseInt(reMonth), 0).getDate();
             rangeEndStr = `${reYear}-${reMonth.padStart(2, '0')}-${lastDay}`;
          } else rangeEndStr = `${reYear}-12-31`;
          
          dateFilter = `date:${rangeStartStr}..${rangeEndStr}`;
       }
    } else {
       localStorage.removeItem('cytusGalleryCollectionDateFilter');
    }
    
    document.getElementById('collection-filter-modal').classList.add('hidden');
    
    const currentUrl = new URL(window.location.href);
    if (checkedTags.length > 0 && checkedTags.length !== totalTags) {
       currentUrl.searchParams.set("followedTags", checkedTags.join(","));
    } else {
       currentUrl.searchParams.delete("followedTags");
    }
    
    let existingQuery = currentUrl.searchParams.get("query") || "";
    existingQuery = existingQuery.replace(/date:[^\s]+/g, '').trim(); 
    
    if (dateFilter) {
       existingQuery = (existingQuery + " " + dateFilter).trim();
    }
    
    if (existingQuery) {
       currentUrl.searchParams.set("query", existingQuery);
    } else {
       currentUrl.searchParams.delete("query");
    }
    
    if (typeof window.showLoader === 'function') window.showLoader("Memuat Konten...");
    window.location.href = currentUrl.toString();
  };

  window.updateCollectionTabVisuals = function() {
    const hasDateFilterStr = localStorage.getItem('cytusGalleryCollectionDateFilter');
    const hasTagsFilterStr = localStorage.getItem('cytusGalleryCollectionTagsFilter');
    let isActive = false;
    
    if (hasTagsFilterStr) {
       const t = JSON.parse(hasTagsFilterStr);
       if (t && t.length > 0) isActive = true;
    }
    if (hasDateFilterStr) {
       const d = JSON.parse(hasDateFilterStr);
       if (d && d.enabled) isActive = true;
    }
    
    const collectionTab = document.querySelector('a[data-tab="collection"]');
    
    if (collectionTab) {
      const urlParams = new URLSearchParams(window.location.search);
      const currentTab = urlParams.get('tab') || 'contents';
      const isCurrentTab = currentTab === 'collection' || collectionTab.classList.contains("text-white");
      
      if (isActive && isCurrentTab) {
         collectionTab.classList.remove('text-white', 'text-gray-500');
         collectionTab.classList.add('!text-cyan-400', 'drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]');
      } else {
         collectionTab.classList.remove('!text-cyan-400', 'drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]');
         if (isCurrentTab) {
            collectionTab.classList.add('text-white');
            collectionTab.classList.remove('text-gray-500');
         } else {
            collectionTab.classList.add('text-gray-500');
            collectionTab.classList.remove('text-white');
         }
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.updateCollectionTabVisuals();
  });
