(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toast = document.querySelector('[data-toast]');
  let toastTimer;

  const introSentinel = document.querySelector('.playlist-motion');
  const linksNav = document.querySelector('.links-nav');
  let introFallbackTimer;

  const finishIntro = () => {
    window.clearTimeout(introFallbackTimer);
    root.classList.add('is-ready');
  };

  introSentinel?.addEventListener('animationend', (event) => {
    if (event.animationName === 'glyph-develop') finishIntro();
  });

  // Prioritize an intentional interaction over the staggered entrance. Without
  // this, leaving a link early can restart its delayed, opacity-zero first frame.
  linksNav?.addEventListener('pointerover', finishIntro, { once: true, passive: true });
  linksNav?.addEventListener('focusin', finishIntro, { once: true });

  introFallbackTimer = window.setTimeout(finishIntro, reducedMotion.matches ? 160 : 1400);

  document.querySelector('.skip-link')?.addEventListener('click', () => {
    window.requestAnimationFrame(() => {
      document.querySelector('#main-content')?.focus({ preventScroll: true });
    });
  });

  const showToast = (message) => {
    if (!toast) return;

    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2600);
  };

  const logoButton = document.querySelector('[data-logo-button]');
  const finalLogoPath = document.querySelector('.logo-piece-4 path');
  let logoClicks = 0;
  let clickResetTimer;
  let replayFallbackTimer;
  let partyTimer;

  const finishLogoReplay = () => {
    window.clearTimeout(replayFallbackTimer);
    logoButton?.classList.remove('is-replaying');
  };

  finalLogoPath?.addEventListener('animationend', (event) => {
    if (event.animationName === 'logo-ink-replay') finishLogoReplay();
  });

  const registerLogoTap = () => {
    logoClicks += 1;
    window.clearTimeout(clickResetTimer);
    clickResetTimer = window.setTimeout(() => {
      logoClicks = 0;
    }, 1500);

    if (logoClicks < 3) return;

    logoClicks = 0;
    toggleClayEgg();
  };

  logoButton?.addEventListener('click', () => {
    // A tap on the clay silhouette also lands here (the canvas doesn't catch
    // pointer events); the egg already counted that physical tap.
    if (Date.now() - lastClayTap < 350) return;

    if (!clayActive) {
      window.clearTimeout(replayFallbackTimer);
      logoButton.classList.remove('is-replaying');

      if (!reducedMotion.matches) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            logoButton.classList.add('is-replaying');
            replayFallbackTimer = window.setTimeout(finishLogoReplay, 1400);
          });
        });
      }
    }

    registerLogoTap();
  });

  const logoParty = () => {
    if (!reducedMotion.matches) {
      window.clearTimeout(partyTimer);
      document.body.classList.remove('logo-party');
      window.requestAnimationFrame(() => {
        document.body.classList.add('logo-party');
        partyTimer = window.setTimeout(() => {
          document.body.classList.remove('logo-party');
        }, 650);
      });
    }
    showToast('Triple blum unlocked. Very productive.');
  };

  // Triple blum: the flat logo morphs into 3D clay in place (borrowed from
  // jordanrblum.com's hero); triple again to morph back. Falls back to the
  // classic party pulse when motion is reduced or three.js can't load/run.
  const logoPanel = document.querySelector('.logo-panel');
  let clayEggPromise;
  let clayActive = false;
  let lastClayTap = 0;

  const loadClayEgg = () => {
    clayEggPromise ??= import('./clay-mark.js')
      .then(({ mountClayMark }) => {
        const mark = document.querySelector('.brand-mark');
        if (!mark || !logoPanel) throw new Error('no mark');
        return mountClayMark(logoPanel, mark, {
          onTap: () => {
            lastClayTap = Date.now();
            registerLogoTap();
          },
        });
      })
      .catch((error) => {
        clayEggPromise = undefined;
        throw error;
      });
    return clayEggPromise;
  };

  const toggleClayEgg = () => {
    if (reducedMotion.matches || !logoPanel) {
      logoParty();
      return;
    }

    loadClayEgg().then(
      (egg) => {
        if (!clayActive) {
          clayActive = true;
          finishLogoReplay();
          egg.morphIn();
          logoPanel.classList.add('is-clay');
          showToast('Clay mode. Grab it.');
        } else {
          clayActive = false;
          logoPanel.classList.remove('is-clay');
          egg.morphOut();
        }
      },
      () => logoParty(),
    );
  };

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && clayActive) toggleClayEgg();
  });

  const saveDarkroom = (enabled) => {
    try {
      localStorage.setItem('blum-darkroom', enabled ? 'on' : 'off');
    } catch (error) {
      // The visual toggle does not depend on storage being available.
    }
  };

  const toggleDarkroom = () => {
    const enabled = root.dataset.darkroom !== 'on';

    if (enabled) {
      root.dataset.darkroom = 'on';
    } else {
      delete root.dataset.darkroom;
    }

    saveDarkroom(enabled);
    showToast(enabled ? 'Darkroom mode developed.' : 'Back into the daylight.');
  };

  let keywordBuffer = '';
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (
      target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    );

    if (isTyping || event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;

    keywordBuffer = `${keywordBuffer}${event.key.toLowerCase()}`.slice(-12);
    if (keywordBuffer.endsWith('grain')) {
      keywordBuffer = '';
      toggleDarkroom();
    }
  });

  document.querySelector('[data-grain-hint]')?.addEventListener('click', () => {
    showToast('A hint: type “grain” anywhere on the page.');
  });

  const playlistOpen = document.querySelector('[data-playlist-open]');
  const playlistDialog = document.querySelector('#playlist-dialog');
  const playlistClose = document.querySelector('[data-playlist-close]');
  const playlistFrame = document.querySelector('[data-playlist-frame]');
  const embedLoading = document.querySelector('[data-embed-loading]');

  const loadPlaylist = () => {
    if (!(playlistFrame instanceof HTMLIFrameElement) || playlistFrame.hasAttribute('src')) return;

    const source = playlistFrame.dataset.src;
    if (source) playlistFrame.src = source;
  };

  if (
    playlistOpen instanceof HTMLAnchorElement &&
    playlistDialog instanceof HTMLElement &&
    typeof playlistDialog.showModal === 'function'
  ) {
    playlistOpen.setAttribute('aria-haspopup', 'dialog');
    playlistOpen.setAttribute('aria-controls', playlistDialog.id);
    playlistOpen.setAttribute('aria-expanded', 'false');

    playlistOpen.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      loadPlaylist();
      playlistOpen.setAttribute('aria-expanded', 'true');
      playlistDialog.showModal();
    });

    playlistClose?.addEventListener('click', () => {
      playlistDialog.close();
    });

    playlistDialog.addEventListener('click', (event) => {
      if (event.target === playlistDialog) playlistDialog.close();
    });

    playlistDialog.addEventListener('close', () => {
      playlistOpen.setAttribute('aria-expanded', 'false');
      if (playlistFrame instanceof HTMLIFrameElement) {
        playlistFrame.removeAttribute('src');
        playlistFrame.classList.remove('is-loaded');
        embedLoading?.classList.remove('is-hidden');
      }
      window.requestAnimationFrame(() => playlistOpen.focus({ preventScroll: true }));
    });
  }

  playlistFrame?.addEventListener('load', () => {
    if (!(playlistFrame instanceof HTMLIFrameElement) || !playlistFrame.src.startsWith('https://open.spotify.com/')) return;
    playlistFrame.classList.add('is-loaded');
    embedLoading?.classList.add('is-hidden');
  });

  console.info('%cblumblumblum', 'color:#9c4037;font-weight:700;font-size:14px');
  console.info('There are at least two tiny secrets here. Start with “grain”.');
})();
