// PWA Install Prompt Handler
class InstallPrompt {
    constructor() {
        this.deferredPrompt = null;
        this.installPromptShown = false;
        this.initialize();
    }

    initialize() {
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();

            // Stash the event so it can be triggered later
            this.deferredPrompt = e;

            // Check if we should show the prompt
            this.checkAndShowPrompt();
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA installed successfully');
            this.deferredPrompt = null;
            this.hideInstallPrompt();

            // Send analytics event
            if (window.gtag) {
                gtag('event', 'pwa_installed');
            }
        });

        // Check if already installed
        this.checkIfInstalled();
    }

    checkIfInstalled() {
        // Check if running in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true) {
            console.log('📱 App is running in standalone mode');
            document.body.classList.add('app-installed');
            return true;
        }
        return false;
    }

    checkAndShowPrompt() {
        // Don't show if already installed
        if (this.checkIfInstalled()) return;

        // Don't show if already shown in this session
        if (this.installPromptShown) return;

        // Check if user dismissed before
        if (localStorage.getItem('pwa-install-dismissed')) {
            const dismissedTime = parseInt(localStorage.getItem('pwa-install-dismissed'));
            const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

            // Only show again after 7 days
            if (daysSinceDismissed < 7) return;
        }

        // Show prompt after 30 seconds
        setTimeout(() => {
            this.showInstallPrompt();
        }, 30000);
    }

    showInstallPrompt() {
        // Don't show if no deferred prompt
        if (!this.deferredPrompt) return;

        // Create prompt element
        const promptEl = document.createElement('div');
        promptEl.className = 'install-prompt';
        promptEl.id = 'installPrompt';
        promptEl.innerHTML = `
            <i class="fas fa-download" style="font-size: 24px; color: var(--primary);"></i>
            <div style="flex: 1;">
                <strong style="color: var(--text-primary);">Install GeoFaceAttend</strong>
                <p style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">Install for quick access and offline support</p>
            </div>
            <button class="install-btn" onclick="installPrompt.install()">
                <i class="fas fa-download"></i> Install
            </button>
            <button class="close-btn" onclick="installPrompt.dismiss()">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(promptEl);
        this.installPromptShown = true;
    }

    hideInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        if (prompt) {
            prompt.remove();
        }
    }

    async install() {
        if (!this.deferredPrompt) {
            alert('Installation not available at this time');
            return;
        }

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for user response
        const choiceResult = await this.deferredPrompt.userChoice;

        if (choiceResult.outcome === 'accepted') {
            console.log('✅ User accepted install prompt');
        } else {
            console.log('❌ User dismissed install prompt');
        }

        // Clear the deferred prompt
        this.deferredPrompt = null;

        // Hide our custom prompt
        this.hideInstallPrompt();
    }

    dismiss() {
        // Hide the prompt
        this.hideInstallPrompt();

        // Remember dismissal time
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());

        // Clear deferred prompt
        this.deferredPrompt = null;
    }

    // Manual trigger (for settings page)
    manualInstall() {
        if (this.deferredPrompt) {
            this.install();
        } else {
            alert('Installation not available. The app might already be installed or not yet ready.');
        }
    }
}

// Initialize install prompt
const installPrompt = new InstallPrompt();
window.installPrompt = installPrompt;

// Add install option to settings menu (call this from your app)
function showInstallOption() {
    if (installPrompt.deferredPrompt) {
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        menuItem.innerHTML = `
            <i class="fas fa-download"></i>
            <span>Install App</span>
        `;
        menuItem.onclick = () => installPrompt.manualInstall();

        // Add to your settings menu
        const settingsMenu = document.getElementById('settingsMenu');
        if (settingsMenu) {
            settingsMenu.appendChild(menuItem);
        }
    }
}