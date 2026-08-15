    const navEntries = performance.getEntriesByType("navigation");
    const isReload = navEntries.length > 0 && navEntries[0].type === "reload";
    const isHome = window.location.pathname === '/' || window.location.pathname === '/search';
    const isDetail = window.location.pathname.startsWith('/posts/');
    
    window.setupLoaderContent = (targetPath) => {
        const spinner = document.getElementById('loader-spinner');
        const gridSkel = document.getElementById('loader-skeleton-grid');
        const listSkel = document.getElementById('loader-skeleton-list');
        const navbarSkel = document.getElementById('loader-skeleton-navbar');
        const searchSkel = document.getElementById('loader-skeleton-search');
        
        if (spinner) spinner.classList.add('hidden');
        if (gridSkel) gridSkel.classList.add('hidden');
        if (listSkel) listSkel.classList.add('hidden');
        if (navbarSkel) navbarSkel.classList.add('hidden');
        if (searchSkel) searchSkel.classList.add('hidden');
        
        const isGrid = targetPath === '/' || targetPath.startsWith('/search');
        const isList = targetPath.startsWith('/notifications');
        
        if (isGrid && gridSkel) {
           gridSkel.classList.remove('hidden');
           if (navbarSkel) navbarSkel.classList.remove('hidden');
           if (searchSkel) searchSkel.classList.remove('hidden');
        } else if (isList && listSkel) {
           listSkel.classList.remove('hidden');
           if (navbarSkel) navbarSkel.classList.remove('hidden');
        } else if (spinner) {
           spinner.classList.remove('hidden');
        }
    };

    let nextPath = null;
    document.addEventListener('click', (e) => {
       const a = e.target.closest('a');
       if (a && a.href && !a.target && !a.hasAttribute('download')) {
          try {
             nextPath = new URL(a.href).pathname;
          } catch(err) {}
       }
    });

    if (!sessionStorage.getItem('cytus_first_visit') || (isReload && isHome) || isDetail) {
      if (typeof window.setupLoaderContent === 'function') {
         window.setupLoaderContent(window.location.pathname);
      }
      document.getElementById('loading-overlay').classList.remove('opacity-0', 'pointer-events-none');
      document.addEventListener('DOMContentLoaded', () => {
        let isFirstSplash = false;
        if (!sessionStorage.getItem('cytus_first_visit')) {
          sessionStorage.setItem('cytus_first_visit', 'true');
          isFirstSplash = true;
        }
        let pendingRedirect = false;
        if (isHome) {
            const urlParams = new URLSearchParams(window.location.search);
            const savedTab = localStorage.getItem("cytusGalleryActiveTab");
            const currentTab = urlParams.get("tab") || "contents";
            if (savedTab && savedTab !== "contents" && currentTab !== savedTab) {
                pendingRedirect = true;
            }
        }
        
        if (!pendingRedirect) {
          const delay = isFirstSplash ? 1000 : 0;
          setTimeout(() => {
            const loader = document.getElementById('loading-overlay');
            if (loader) {
              loader.style.transitionDuration = '300ms';
              loader.classList.add('opacity-0', 'pointer-events-none');
            }
          }, delay); 
        }
      });
    } else {
      // Pastikan loader langsung hilang jika halaman di-load tanpa splash screen
      document.addEventListener('DOMContentLoaded', () => {
         const loader = document.getElementById('loading-overlay');
         if (loader) {
            loader.style.transitionDuration = '0ms';
            loader.classList.add('opacity-0', 'pointer-events-none');
         }
      });
    }

    window.goToHome = function(e) {
      e.preventDefault();
      if (typeof window.navigateWithFilters === 'function') {
        const isSearchPage = window.location.pathname === '/' || window.location.pathname === '/search';
        window.navigateWithFilters("", 1, null, isSearchPage);
      } else {
        const savedTab = localStorage.getItem("cytusGalleryActiveTab") || "contents";
        let target = "/search";
        if (savedTab !== "contents") target += "?tab=" + savedTab;
        
        const loader = document.getElementById('loading-overlay');
        if (loader) {
          if (typeof window.setupLoaderContent === 'function') {
             window.setupLoaderContent(target);
          }
          loader.style.transitionDuration = '100ms';
          loader.classList.remove('opacity-0', 'pointer-events-none');
        }
        window.location.href = target;
      }
    };

    window.addEventListener('beforeunload', () => {
       const loader = document.getElementById('loading-overlay');
       if (loader) {
         if (typeof window.setupLoaderContent === 'function') {
            window.setupLoaderContent(nextPath || window.location.pathname);
         }
         loader.style.transitionDuration = '100ms';
         loader.classList.remove('opacity-0', 'pointer-events-none');
       }
    });
    
    const hideLoaderForcefully = () => {
       const loader = document.getElementById('loading-overlay');
       if (loader && !loader.classList.contains('opacity-0')) {
          loader.style.transitionDuration = '300ms';
          loader.classList.add('opacity-0', 'pointer-events-none');
       }
    };

    window.addEventListener('pageshow', (event) => {
       setTimeout(hideLoaderForcefully, 50);
       if (event.persisted) setTimeout(hideLoaderForcefully, 300);
    });
    
    document.addEventListener('visibilitychange', () => {
       if (document.visibilityState === 'visible') hideLoaderForcefully();
    });

    // Tampilkan animasi loading saat mengklik post/detail untuk UX yang lebih baik
    document.addEventListener('click', (e) => {
       const link = e.target.closest('a');
       if (link && link.href && link.getAttribute('href').startsWith('/posts/')) {
           const isInfiniteScrollMode = window.location.pathname === '/' || window.location.pathname === '/search';
           const loader = document.getElementById('loading-overlay');
           
           if (isInfiniteScrollMode) {
              // Minta browser membuka di tab baru
              link.setAttribute('target', '_blank');
              
              // Tampilkan loader sementara di tab saat ini agar pengguna tahu proses sedang berjalan
              if (loader) {
                loader.style.transitionDuration = '100ms';
                loader.classList.remove('opacity-0', 'pointer-events-none');
                
                // Sembunyikan loader di tab saat ini lebih cepat karena halaman utama tidak berpindah
                setTimeout(hideLoaderForcefully, 1500);
              }
              return; // Biarkan default action (buka tab baru) berjalan
           }
           
           // Mode standar (bukan infinite scroll), pindah halaman di tab yang sama
           if (loader && link.getAttribute('target') !== '_blank') {
             loader.style.transitionDuration = '100ms';
             loader.classList.remove('opacity-0', 'pointer-events-none');
             
             // Failsafe: Sembunyikan kembali setelah 4 detik jika gagal pindah
             setTimeout(hideLoaderForcefully, 4000);
           }
       }
    });
    (function() {
      // Jalankan hanya di halaman utama ATAU di halaman pencarian tanpa query parameter
      const isHome = window.location.pathname === '/';
      const isSearchWithoutQuery = window.location.pathname === '/search' && window.location.search === '';
      if (!isHome && !isSearchWithoutQuery) return;

      // Fungsi untuk membangun URL dari filter
      const buildUrlFromFilters = (filters) => {
        const params = new URLSearchParams();
        let filterQueryParts = [];

        let explicitLocked = true;
        const isBypassUser = (document.getElementById('cytus-header-config')?.dataset.bypass === 'true');

        if (filters.ratingToggle && filters.rating && filters.rating !== "all") {
          if (filters.rating === "s") {
             filterQueryParts.push("rating:s");
             explicitLocked = false;
          } else if (filters.rating === "not_e") {
             filterQueryParts.push("rating:g,s");
             explicitLocked = false;
          } else if (filters.rating === "g") {
             filterQueryParts.push("rating:g");
             explicitLocked = false;
          } else if (filters.rating === "e") {
             if (isBypassUser) {
                filterQueryParts.push("rating:e,q");
                explicitLocked = false;
             } else {
                filterQueryParts.push("rating:g");
                explicitLocked = false;
                filters.rating = "g";
                localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
             }
          }
        } else if (!filters.ratingToggle && isBypassUser) {
          explicitLocked = false;
        }

        if (explicitLocked) {
           filterQueryParts.push("rating:g,s");
        }
        if (filters.typeToggle && filters.type) {
          let typeTag = '';
          if (filters.type === 'image') typeTag = 'filetype:jpg,jpeg,png,webp,gif,avif';
          else if (filters.type === 'video') typeTag = 'filetype:mp4,webm';
          if (typeTag) filterQueryParts.push(typeTag);
        }

        const filterQuery = filterQueryParts.join(' ');
        if (filterQuery) {
          params.append('query', filterQuery);
        }

        params.append('limit', filters.limit || 25);
        if (filters.lazyloadToggle) {
          params.append('lazyload', 'true');
        }

        const queryString = params.toString();
        return `/search?${queryString}`;
      };

      let filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
      // Jika pengguna baru (tidak ada setting), buat defaultnya
      if (!filters) {
        filters = {
          ratingToggle: true,
          rating: "g",
          typeToggle: false,
          type: "image",
          limit: "25",
          autoplayToggle: false,
          lazyloadToggle: true,
        };
        localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
      }

      // Cek jika perlu redirect (pengguna baru atau URL cocok untuk redirect)
      const needsRedirect = true;

      if (needsRedirect) {
        const newUrl = buildUrlFromFilters(filters);
        // Ganti halaman saat ini, ini lebih cepat dari redirect biasa
        window.location.replace(newUrl);
      }
    })();
    document.addEventListener("DOMContentLoaded", function() {
      const notifBtn = document.getElementById('notification-btn');
      const mobileNotifBtn = document.getElementById('mobile-notification-btn');
      if (notifBtn || mobileNotifBtn) {
        const notifBadge = document.getElementById('notification-badge');
        const mobileBadge = document.getElementById('mobile-notification-badge');
        const desktopDropdown = document.getElementById('desktop-notification-dropdown');
        const mobileDropdown = document.getElementById('mobile-notification-dropdown');
        const notifLists = document.querySelectorAll('.notification-list');
        
        const toggleDropdown = (isMobile) => {
          const targetDropdown = isMobile ? mobileDropdown : desktopDropdown;
          if (!targetDropdown) return;
          
          targetDropdown.classList.toggle('hidden');
          
          // Pastikan dropdown lain tertutup
          const otherDropdown = isMobile ? desktopDropdown : mobileDropdown;
          if (otherDropdown) otherDropdown.classList.add('hidden');

          if (!targetDropdown.classList.contains('hidden')) {
             // Sembunyikan badge secara instan tanpa delay
             if (notifBadge) {
               notifBadge.classList.add('hidden', 'scale-100');
               notifBadge.classList.remove('scale-150');
               notifBadge.textContent = '0';
             }
             if (mobileBadge) {
               mobileBadge.classList.add('hidden', 'scale-100');
               mobileBadge.classList.remove('scale-150');
               mobileBadge.textContent = '0';
             }
             
             // Kirim request ke server di background untuk menandai semua sebagai dibaca
             fetch('/api/notifications/read', { method: 'POST' }).catch(console.error);
          }
        };

        if (notifBtn) notifBtn.addEventListener('click', (e) => toggleDropdown(false));
        if (mobileNotifBtn) {
          mobileNotifBtn.addEventListener('click', (e) => toggleDropdown(true));
        }

        document.addEventListener('click', (e) => {
          const clickedNotifBtn = (notifBtn && notifBtn.contains(e.target)) || (mobileNotifBtn && mobileNotifBtn.contains(e.target));
          const clickedDropdown = (desktopDropdown && desktopDropdown.contains(e.target)) || (mobileDropdown && mobileDropdown.contains(e.target));
          
          if (!clickedNotifBtn && !clickedDropdown) {
            if (desktopDropdown) desktopDropdown.classList.add('hidden');
            if (mobileDropdown) mobileDropdown.classList.add('hidden');
          }
        });

        async function fetchNotifications() {
          // Fitur notifikasi dimatikan sementara
          return;
          
          // [Fix #4] Skip polling jika tab tidak aktif/di-minimize
          if (document.visibilityState === 'hidden') return;
          try {
            const filters = JSON.parse(localStorage.getItem('cytusGalleryFilters') || '{}');
            let ratingParam = filters.rating || 'not_e'; // default
            // Gunakan timestamp untuk memastikan tidak ada cache browser yang tersangkut
            const ts = new Date().getTime();
            const res = await fetch(`/api/notifications/sync?rating=${ratingParam}&_t=${ts}`, { cache: 'no-store' });
            if (res.ok) {
              const data = await res.json();
              if (data.unreadCount !== undefined) {
                const countText = data.unreadCount > 99 ? '99+' : data.unreadCount;
                if (data.unreadCount > 0) {
                  if (notifBadge) {
                    if (notifBadge.textContent !== countText) {
                       notifBadge.classList.add('scale-150', 'transition-transform', 'duration-300');
                       setTimeout(() => notifBadge.classList.remove('scale-150'), 300);
                    }
                    notifBadge.textContent = countText;
                    notifBadge.classList.remove('hidden');
                  }
                  if (mobileBadge) {
                     if (mobileBadge.textContent !== countText) {
                        mobileBadge.classList.add('scale-150', 'transition-transform', 'duration-300');
                        setTimeout(() => mobileBadge.classList.remove('scale-150'), 300);
                     }
                     mobileBadge.textContent = countText;
                     mobileBadge.classList.remove('hidden');
                  }
                } else {
                  if (notifBadge) notifBadge.classList.add('hidden');
                  if (mobileBadge) mobileBadge.classList.add('hidden');
                }
              }
              
              if (data.notifications && data.notifications.length > 0) {
                // Check for new notifications to animate them (using the first list as reference)
                const referenceList = notifLists.length > 0 ? notifLists[0] : null;
                let existingIds = [];
                if (referenceList) {
                   existingIds = Array.from(referenceList.querySelectorAll('a')).map(a => a.getAttribute('data-id'));
                }
                
                const htmlStr = data.notifications.map(n => {
                  const isNew = !existingIds.includes(n.id) && existingIds.length > 0;
                  return `
                  <a href="${n.link}" data-id="${n.id}" class="flex p-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${n.isRead ? 'opacity-75' : 'bg-gray-700/50'} ${isNew ? 'animate-slide-right' : ''}">
                    ${n.imageUrl ? `<img src="${n.imageUrl}" class="w-12 h-12 object-cover rounded-md mr-3" alt="Thumb">` : ''}
                    <div class="flex-grow">
                      <div class="flex items-center flex-wrap gap-2 mb-1 pr-12 relative">
                        <div class="font-semibold text-white text-sm">${n.title}</div>
                        ${n.extension ? `<span class="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5">${n.extension.toUpperCase()}</span>` : ''}
                        ${n.rating ? `<span class="${n.rating==='g'?'bg-green-600':n.rating==='s'?'bg-yellow-600':n.rating==='q'?'bg-purple-600':'bg-red-600'} text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5">${n.rating.toUpperCase()}</span>` : ''}
                        <span class="text-[10px] text-gray-500 absolute top-0 right-0">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div class="text-xs text-gray-300 line-clamp-2">${n.message.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div>
                    </div>
                  </a>
                `}).join('');
                notifLists.forEach(list => list.innerHTML = htmlStr);
              } else {
                notifLists.forEach(list => list.innerHTML = '<div class="p-4 text-sm text-gray-400 text-center">Belum ada notifikasi</div>');
              }
              
              // Dispatch event for other scripts (e.g., notifications page)
              window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { notifications: data.notifications } }));
            }
          } catch (e) {
            console.error("Failed to fetch notifications");
            notifLists.forEach(list => list.innerHTML = '<div class="p-4 text-sm text-red-400 text-center">Gagal memuat notifikasi.</div>');
          }
        }
        
        fetchNotifications();
        setInterval(fetchNotifications, 120 * 1000); // 2 menit

        // [Fix #4] Langsung fetch saat user kembali ke tab setelah lama pergi
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            fetchNotifications();
          }
        });
      }
    });