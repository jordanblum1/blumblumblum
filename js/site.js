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

  // Warm the clay path while the triple-tap is still in flight: tap one opens
  // the CDN connection, tap two starts fetching three.js — so tap three
  // usually morphs instantly. Costs nothing unless someone taps the logo.
  const warmClayEgg = () => {
    if (reducedMotion.matches) return;
    if (logoClicks === 1 && !document.querySelector('[data-clay-preconnect]')) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = 'https://cdn.jsdelivr.net';
      link.crossOrigin = 'anonymous';
      link.setAttribute('data-clay-preconnect', '');
      document.head.append(link);
    }
    if (logoClicks === 2) loadClayEgg().catch(() => {});
  };

  const registerLogoTap = () => {
    logoClicks += 1;
    window.clearTimeout(clickResetTimer);
    clickResetTimer = window.setTimeout(() => {
      logoClicks = 0;
    }, 1500);

    if (logoClicks < 3) {
      warmClayEgg();
      return;
    }

    logoClicks = 0;
    toggleClayEgg();
  };

  logoButton?.addEventListener('click', (event) => {
    // A long-press already spun the roulette; it is not a tap.
    if (longPressed) {
      longPressed = false;
      return;
    }
    // Mid-game, pieces are dragged by pointer; a keyboard press sends one home.
    if (catchGame) {
      if (event.detail === 0) catchGame.homeNext?.();
      return;
    }
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

  const logoParty = (message = 'Triple blum unlocked. Very productive.') => {
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
    showToast(message);
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
    if (event.key !== 'Escape') return;
    if (clayActive) toggleClayEgg();
    catchGame?.stop?.();
  });

  // Long-press the logo for link roulette: the cards spin like a slot machine
  // and one lights up. Short taps keep counting toward the clay egg; a press
  // long enough to spin swallows its own click.
  const linkItems = [...document.querySelectorAll('.links-grid li')];
  let pressTimer;
  let pressOrigin = [0, 0];
  let longPressed = false;
  let rouletteTimer;

  const linkRoulette = () => {
    window.clearTimeout(rouletteTimer);
    linkItems.forEach((item) => item.classList.remove('is-rolling', 'is-picked'));
    const pick = Math.floor(Math.random() * linkItems.length);
    const hops = linkItems.length + pick;

    // each hop waits a little longer, like a reel running out of spin
    const hop = (index) => {
      linkItems.forEach((item, i) => item.classList.toggle('is-rolling', i === index % linkItems.length));
      if (index < hops) {
        rouletteTimer = window.setTimeout(() => hop(index + 1), 45 + index * index * 1.2);
        return;
      }
      const picked = linkItems[pick];
      picked.classList.replace('is-rolling', 'is-picked');
      document.body.classList.remove('is-rouletting');
      showToast(`Today you should look at ${picked.querySelector('.link-label')?.textContent}.`);
      rouletteTimer = window.setTimeout(() => picked.classList.remove('is-picked'), 2600);
    };

    document.body.classList.toggle('is-rouletting', !reducedMotion.matches);
    hop(reducedMotion.matches ? hops : 0);
  };

  const startPress = (x, y) => {
    window.clearTimeout(pressTimer);
    longPressed = false;
    if (clayActive || catchGame) return;
    pressOrigin = [x, y];
    pressTimer = window.setTimeout(() => {
      longPressed = true;
      linkRoulette();
    }, 600);
  };
  const cancelPress = () => window.clearTimeout(pressTimer);

  logoButton?.addEventListener('pointerdown', (event) => {
    if (event.isPrimary && event.button === 0) startPress(event.clientX, event.clientY);
  });
  logoButton?.addEventListener('pointermove', (event) => {
    if (Math.hypot(event.clientX - pressOrigin[0], event.clientY - pressOrigin[1]) > 10) cancelPress();
  });
  ['pointerup', 'pointercancel', 'keyup'].forEach((type) => logoButton?.addEventListener(type, cancelPress));
  logoButton?.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) startPress(0, 0);
  });
  // phones open a context menu on long-press; the roulette owns that gesture
  logoButton?.addEventListener('contextmenu', (event) => event.preventDefault());

  // Catch the letters: "bbb" or a phone shake drops the logo pieces like
  // Tetris blocks to drag back home. The game loads only when it fires.
  let catchGame = null;

  const startCatch = () => {
    if (catchGame || clayActive || !logoPanel) return;
    catchGame = {};
    finishLogoReplay();
    import('./catch-letters.js').then(
      ({ catchLetters }) => {
        catchGame = catchLetters(document.querySelector('.brand-mark'), {
          onWin: () => logoParty('Rebuilt. blumblumblum, good as new.'),
          onEnd: () => {
            catchGame = null;
            logoPanel.classList.remove('is-catching');
          },
        });
        logoPanel.classList.add('is-catching');
        showToast('Catch the letters! Drag them home.');
      },
      () => {
        catchGame = null;
      },
    );
  };

  // A shake is a few hard jolts in quick succession. iOS only allows motion
  // after a permission prompt from a gesture, so it's asked from the hint.
  let shakes = 0;
  let shakeAt = 0;
  let lastMotion;
  const onMotion = ({ accelerationIncludingGravity: a }) => {
    if (a?.x == null) return;
    const jolt = lastMotion
      ? Math.abs(a.x - lastMotion.x) + Math.abs(a.y - lastMotion.y) + Math.abs(a.z - lastMotion.z)
      : 0;
    lastMotion = { x: a.x, y: a.y, z: a.z };
    const now = Date.now();
    if (jolt < 24 || now - shakeAt < 120) return;
    shakes = now - shakeAt < 900 ? shakes + 1 : 1;
    shakeAt = now;
    if (shakes >= 4) {
      shakes = 0;
      startCatch();
    }
  };
  const listenForShake = () => window.addEventListener('devicemotion', onMotion);
  const askForMotion = window.DeviceMotionEvent?.requestPermission;
  if (!askForMotion && window.matchMedia('(pointer: coarse)').matches) listenForShake();

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
  let bPresses = 0;
  let lastB = 0;
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (
      target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    );

    if (isTyping || event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;

    const key = event.key.toLowerCase();
    const now = Date.now();
    bPresses = key === 'b' && now - lastB < 450 ? bPresses + 1 : Number(key === 'b');
    lastB = now;
    if (bPresses === 3) {
      bPresses = 0;
      startCatch();
    }

    keywordBuffer = `${keywordBuffer}${key}`.slice(-12);
    if (keywordBuffer.endsWith('grain')) {
      keywordBuffer = '';
      toggleDarkroom();
    }
  });

  document.querySelector('[data-grain-hint]')?.addEventListener('click', () => {
    showToast('A hint: type “grain” anywhere on the page.');
    askForMotion?.call(window.DeviceMotionEvent).then((state) => {
      if (state === 'granted') listenForShake();
    }, () => {});
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
  console.info('There are a few tiny secrets here. Start with “grain”.');
})();
