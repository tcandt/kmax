<template>
  <!-- Public share page rendered directly by vue-router -->
  <router-view v-if="isSharePage" />
  <div v-else-if="!authStore.isLoggedIn" style="width: 100vw; height: 100vh;">
    <Login />
  </div>
  <div v-else class="app-container" :class="{ 'is-resizing': isResizing }">
    <!-- Global license expiration modal overlay -->
    <div v-if="deviceStore.isLicenseExpired" class="license-block-overlay">
      <div class="license-block-card">
        <div class="license-block-header">
          <div class="license-alert-icon">⚠️</div>
          <h2>System License Expired</h2>
          <p class="license-block-subtitle">This version is no longer active. Please renew or activate your license.</p>
        </div>
        
        <div class="license-block-body">
          <p class="license-error-tip">{{ deviceStore.licenseErrorMsg }}</p>
          
          <div class="license-info-row">
            <span class="info-label">Server Machine ID:</span>
            <div class="machine-id-container">
              <code class="machine-id-code">{{ deviceStore.globalMachineID || 'Fetching...' }}</code>
              <button class="copy-code-btn" @click="copyMachineID" :disabled="!deviceStore.globalMachineID">
                {{ copySuccess ? 'Copied' : 'Copy' }}
              </button>
            </div>
          </div>
          
          <div class="license-input-group">
            <label for="license-input">Enter License Activation Key:</label>
            <textarea 
              id="license-input" 
              v-model="activationKey" 
              placeholder="Paste your activation key here..."
              rows="4"
            ></textarea>
          </div>
          
          <div v-if="activationError" class="activation-error-msg">
            ❌ {{ activationError }}
          </div>
          
          <div class="license-action-buttons">
            <button class="activate-btn" :disabled="isActivating || !activationKey.trim()" @click="submitActivation">
              {{ isActivating ? 'Activating...' : 'Activate & Unlock' }}
            </button>
          </div>
        </div>
        
        <div class="license-block-footer">
          <p>Don't have an activation key? Get one here:</p>
          <div class="contact-links">
            <a href="https://m.tb.cn/h.8UxnpeF?tk=HTNmgBqagHA" target="_blank" rel="noopener" class="footer-purchase-link">🛒 Purchase Activation Key</a>
            <span class="footer-divider">|</span>
            <a href="mailto:cloudphone@qq.com" class="footer-email">📧 Contact: cloudphone@qq.com</a>
          </div>
        </div>
      </div>
    </div>

    <!-- 1. Global sidebar navigation (desktop only) -->
    <nav class="side-nav" :class="{ expanded: isNavExpanded }" v-if="!isMobile">
      <button class="nav-brand" @click="isNavExpanded = !isNavExpanded" :title="isNavExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'">
        <svg class="nav-brand-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        </svg>
        <span class="nav-brand-text">Cloud Phone</span>
        <span class="nav-brand-collapse-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="11 17 6 12 11 7"></polyline>
            <polyline points="18 17 13 12 18 7"></polyline>
          </svg>
        </span>
      </button>
      <div class="nav-links">
        <a href="javascript:void(0)" @click="navigateTo('/')" class="nav-item" :class="{ active: !showDeployPage && !showFilePage && !showTerminalPage && !showMonitorPage && !showUserAdminPage && !showBatchPage && !showShareAdminPage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
          <span class="nav-item-text">Devices</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/monitor')" class="nav-item" :class="{ active: showMonitorPage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span class="nav-item-text">Dashboard</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/batch')" class="nav-item" :class="{ active: showBatchPage }" v-if="authStore.isAdmin">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1"></rect>
            <rect x="14" y="3" width="7" height="5" rx="1"></rect>
            <rect x="14" y="12" width="7" height="9" rx="1"></rect>
            <rect x="3" y="16" width="7" height="5" rx="1"></rect>
          </svg>
          <span class="nav-item-text">Batch</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/files')" class="nav-item" :class="{ active: showFilePage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="nav-item-text">Files</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/deploy')" class="nav-item" :class="{ active: showDeployPage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="7" y="2" width="10" height="7" rx="1"></rect>
            <line x1="10" y1="5.5" x2="10" y2="5.51"></line>
            <line x1="14" y1="5.5" x2="14" y2="5.51"></line>
            <path d="M6 9h12v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"></path>
            <path d="M12 16v6"></path>
          </svg>
          <span class="nav-item-text">Deploy</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/terminal')" class="nav-item" :class="{ active: showTerminalPage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span class="nav-item-text">Terminal</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/advanced')" class="nav-item" :class="{ active: showAdvancedPage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          <span class="nav-item-text">Peripherals</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/shares')" class="nav-item" :class="{ active: showShareAdminPage }" title="Share & Card Key Management" v-if="authStore.isAdmin">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span class="nav-item-text">Shares</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/admin')" class="nav-item" :class="{ active: showUserAdminPage }" v-if="authStore.role === 'admin'">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span class="nav-item-text">Users</span>
        </a>
        <a href="javascript:void(0)" @click="handleLogout" class="nav-item logout-nav-item" title="Log Out">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span class="nav-item-text">Logout</span>
        </a>
      </div>
      <div class="nav-tag-group" v-if="!showDeployPage && !showFilePage && !showMonitorPage && !showAdvancedPage && !showShareAdminPage">
        <div class="nav-tag-group-title">
          <span>Tags</span>
          <button class="nav-tag-manage-btn" @click="openTagManager">
            <span class="manage-plus">+</span>
            <span class="manage-text">Manage</span>
          </button>
        </div>
        <div class="nav-tag-list">
          <button
            class="nav-tag-item"
            :class="{ active: tagStore.selectedTagIds.length === 0 && !deviceStore.showOfflineOnly && !deviceStore.showRecentOnly }"
            @click="selectAllDevices"
            title="All Devices"
          >
            <span class="nav-tag-dot all"></span>
            <span class="nav-tag-name">All Devices</span>
            <span class="nav-tag-count">{{ deviceStore.devices.length }}</span>
          </button>
          <button
            v-for="tag in tagStore.tags"
            :key="tag.id"
            class="nav-tag-item"
            :class="{ active: tagStore.selectedTagIds.includes(tag.id) }"
            :title="tag.name"
            @click="toggleTag(tag.id)"
          >
            <span class="nav-tag-dot" :style="{ background: tag.color }"></span>
            <span class="nav-tag-name">{{ tag.name }}</span>
            <span class="nav-tag-count">{{ getTagDeviceCount(tag.id) }}</span>
          </button>
          <!-- Recently added filter (registered in last 30 mins) -->
          <button
            class="nav-tag-item recent-tag-item"
            :class="{ active: deviceStore.showRecentOnly }"
            title="Devices added in last 30 minutes"
            @click="toggleRecentView"
          >
            <span class="nav-tag-dot recent"></span>
            <span class="nav-tag-name">Recently Added</span>
            <span class="nav-tag-count">{{ deviceStore.recentDevices.length }}</span>
          </button>
          <!-- Offline devices filter -->
          <button
            class="nav-tag-item offline-tag-item"
            :class="{ active: deviceStore.showOfflineOnly }"
            title="Offline Devices"
            @click="toggleOfflineView"
          >
            <span class="nav-tag-dot offline"></span>
            <span class="nav-tag-name">Offline Devices</span>
            <span class="nav-tag-count">{{ deviceStore.offlineDevices.length }}</span>
          </button>
        </div>
      </div>
      <!-- 4. Version display -->
      <div class="nav-version" :title="systemVersion">
        {{ isNavExpanded ? 'v' + systemVersion : systemVersion.split('-')[0] }}
      </div>
    </nav>

    <!-- 2. Main content area -->
    <main class="main-content" id="main-layout-content">
      <header class="top-bar" v-if="!isMobile">
        <!-- 1. Left: Main title, device count, license badge -->
        <div class="top-bar-left">
          <h1 class="page-title">{{ showDeployPage ? 'Cloud Auto-Deploy' : (showFilePage ? 'Cloud File Manager' : (showMonitorPage ? 'Real-Time Metrics Dashboard' : (showAdvancedPage ? 'Peripheral Control Center' : (showShareAdminPage ? 'Share & Card Key Management' : (showBatchPage ? 'Batch Control Center' : (showUserAdminPage ? 'User Management & Access Control' : 'Device Matrix')))))) }}</h1>
          
          <!-- Online status and license badge on device matrix page -->
          <div class="top-device-stats" v-if="isMainMatrixPage">
            <span class="device-stat-chip online" title="Active online devices">
              <span class="stat-dot"></span>
              {{ deviceStore.onlineDevices.length }} Online
            </span>
            <button 
              class="license-badge-top" 
              :class="deviceStore.licenseBadgeClass" 
              :title="deviceStore.licenseBadgeTitle" 
              @click="showLicensePanel = true"
            >
              {{ deviceStore.licenseBadgeText }}
            </button>
          </div>
        </div>

        <!-- 2. Center: Global search box -->
        <div class="top-bar-center" v-if="isMainMatrixPage">
          <div class="top-search-box" :class="{ 'has-query': !!deviceStore.searchQuery }">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              ref="topSearchInputRef"
              v-model="deviceStore.searchQuery"
              type="text"
              placeholder="Search by name, IP, ID or tag... (⌘K)"
              @keydown.esc="deviceStore.searchQuery = ''"
            />
            <button 
              v-if="deviceStore.searchQuery" 
              class="clear-search-btn" 
              @click="deviceStore.searchQuery = ''" 
              title="Clear Search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <kbd class="search-shortcut-badge" v-else>⌘K</kbd>
          </div>
        </div>
        <div class="top-bar-center-placeholder" v-else></div>

        <!-- 3. Right: Header actions & user menu -->
        <div class="top-bar-right">
          <!-- Device matrix action bar -->
          <div class="top-matrix-actions" v-if="isMainMatrixPage">
            <!-- Display settings dropdown -->
            <div class="top-dropdown-wrap" @click.stop>
              <button 
                class="top-action-btn display-btn" 
                :class="{ active: showDisplayMenu }" 
                @click.stop="showDisplayMenu = !showDisplayMenu"
                title="View and preview settings"
              >
                <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span class="btn-text">Display ▾</span>
              </button>
              
              <transition name="pop">
                <div class="display-dropdown-panel" v-if="showDisplayMenu" @click.stop>
                  <div class="dropdown-panel-title">Display & Preview Settings</div>
                  
                  <div class="dropdown-item-switch" v-if="authStore.isAdmin">
                    <label class="switch-row" title="Streams 10fps hardware-accelerated preview for visible devices">
                      <span class="switch-title">Real-Time Preview</span>
                      <input type="checkbox" v-model="deviceStore.globalPreviewMode" class="switch-input" />
                    </label>
                  </div>

                  <div class="dropdown-item-switch" v-if="authStore.isAdmin">
                    <label class="switch-row" :class="{ disabled: !deviceStore.globalPreviewMode }" title="Directly interact with preview cards (requires real-time preview)">
                      <span class="switch-title">Direct Touch on Card</span>
                      <input type="checkbox" v-model="deviceStore.globalInteractiveMode" :disabled="!deviceStore.globalPreviewMode" class="switch-input" />
                    </label>
                  </div>

                  <div class="dropdown-divider"></div>

                  <div class="dropdown-slider-row" v-if="deviceStore.viewMode === 'grid'">
                    <div class="slider-header">
                      <span>Card Size</span>
                      <span class="slider-val">{{ deviceStore.cardSize }}px</span>
                    </div>
                    <div class="preset-density-row">
                      <button class="preset-density-btn" :class="{ active: deviceStore.cardSize <= 170 }" @click="deviceStore.setCardSize(160)">Compact (160px)</button>
                      <button class="preset-density-btn" :class="{ active: deviceStore.cardSize > 170 && deviceStore.cardSize <= 260 }" @click="deviceStore.setCardSize(220)">Standard (220px)</button>
                      <button class="preset-density-btn" :class="{ active: deviceStore.cardSize > 260 }" @click="deviceStore.setCardSize(320)">Spacious (320px)</button>
                    </div>
                    <input 
                      type="range" 
                      :value="deviceStore.cardSize" 
                      @input="deviceStore.setCardSize($event.target.value)" 
                      min="150" 
                      max="400" 
                      step="10" 
                      class="card-slider-input" 
                    />
                  </div>

                  <div class="dropdown-view-toggle">
                    <button 
                      class="view-toggle-opt" 
                      :class="{ active: deviceStore.viewMode === 'grid' }" 
                      @click="deviceStore.setViewMode('grid')"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                      Grid View
                    </button>
                    <button 
                      class="view-toggle-opt" 
                      :class="{ active: deviceStore.viewMode === 'table' }" 
                      @click="deviceStore.setViewMode('table')"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                      List View
                    </button>
                  </div>
                </div>
              </transition>
            </div>

            <!-- Multi-device close button -->
            <button 
              v-if="deviceStore.activeDeviceIds.length > 0"
              class="top-action-btn primary-action-btn active" 
              @click.stop="deviceStore.closeAllDevices()" 
              title="Close all multi-device connections"
            >
              <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="8" height="18" rx="2"></rect>
                <rect x="14" y="3" width="8" height="18" rx="2"></rect>
              </svg>
              <span class="btn-text">Multi-Device ({{ deviceStore.activeDeviceIds.length }}) ✕</span>
            </button>

            <!-- Batch control button (admin) -->
            <button 
              v-if="authStore.isAdmin"
              class="top-action-btn group-control-btn" 
              :class="{ active: groupControlStore.isGroupControlActive }" 
              @click.stop="toggleGroupControl"
              :title="groupControlStore.isGroupControlActive ? 'Exit Batch Mode' : 'Enter Batch Mode (supports select-all and tag selection)'"
            >
              <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span class="btn-text">{{ groupControlStore.isGroupControlActive ? 'Exit Batch' : 'Batch' }}</span>
            </button>

            <!-- Tag manager button -->
            <button class="top-action-btn" @click="dispatchTopAction('tag-manager')" title="Tag Management">
              <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 12v7a1 1 0 0 1-1 1h-7L4 12V5a1 1 0 0 1 1-1h7l8 8z"></path>
                <circle cx="8.5" cy="8.5" r="1.4"></circle>
              </svg>
              <span class="btn-text">Tags</span>
            </button>

            <!-- Global settings button (admin) -->
            <button class="top-action-btn" @click="dispatchTopAction('global-settings')" title="Global Default Settings" v-if="authStore.isAdmin">
              <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.3 2.7h4.4l.3-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"></path>
              </svg>
              <span class="btn-text">Settings</span>
            </button>
          </div>

          <div class="top-bar-divider" v-if="isMainMatrixPage"></div>

          <!-- Help & support dropdown -->
          <div class="header-help-menu" @click.stop v-if="!authStore.noAuthMode">
            <button class="help-btn" :class="{ active: showHelpMenu }" @click.stop="showHelpMenu = !showHelpMenu" title="Help & Support">
              <svg class="help-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </button>
            <transition name="pop">
              <div class="help-dropdown" v-if="showHelpMenu">
                <div class="help-dropdown-header">Help & Support</div>
                <div class="help-dropdown-list">
                  <a href="https://github.com/hqw700/ScrcpyOverWebRTC" target="_blank" class="help-dropdown-item">
                    <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                    <div class="item-text">
                      <div class="item-title">GitHub Repository</div>
                      <div class="item-desc">Source code, issues, and star support</div>
                    </div>
                  </a>
                  <a href="https://webrtc-phone.com/docs/" target="_blank" class="help-dropdown-item">
                    <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    <div class="item-text">
                      <div class="item-title">Documentation</div>
                      <div class="item-desc">Deployment guides and configuration</div>
                    </div>
                  </a>
                  <a href="https://space.bilibili.com/525503471" target="_blank" class="help-dropdown-item">
                    <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                      <path d="M17 2l-3.5 3.5M7 2l3.5 3.5"></path>
                      <line x1="8" y1="14" x2="8" y2="14.01"></line>
                      <line x1="16" y1="14" x2="16" y2="14.01"></line>
                    </svg>
                    <div class="item-text">
                      <div class="item-title">Video Tutorials</div>
                      <div class="item-desc">Setup tutorials and demos</div>
                    </div>
                  </a>
                  <a href="javascript:void(0)" @click="showLicensePanel = true; showHelpMenu = false" class="help-dropdown-item">
                    <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <div class="item-text">
                      <div class="item-title">License Management</div>
                      <div class="item-desc">View license, usage, machine ID, and activate</div>
                    </div>
                  </a>
                  <a href="mailto:cloudphone@qq.com" @click="showHelpMenu = false" class="help-dropdown-item">
                    <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                    </svg>
                    <div class="item-text">
                      <div class="item-title">Contact</div>
                      <div class="item-desc">Email: cloudphone@qq.com</div>
                    </div>
                  </a>
                </div>
              </div>
            </transition>
          </div>
          <div class="header-user-card">
            <div class="user-avatar" :title="authStore.username + ' (' + (authStore.role === 'admin' ? 'Admin' : 'Standard User') + ')'">
              {{ authStore.username ? authStore.username.substring(0, 1).toUpperCase() : 'U' }}
            </div>
            <span class="user-name" :title="authStore.username">{{ authStore.username }}</span>
            <span class="user-role-badge" :class="authStore.role">
              {{ authStore.role === 'admin' ? 'Admin' : 'Standard User' }}
            </span>
            <span
              v-if="accountExpiryText"
              class="expiry-chip"
              :class="{ expired: accountExpired }"
              :title="accountExpiry ? 'Expires: ' + accountExpiry.toLocaleString('en-US', { hour12: false }) : ''"
            >⏳ {{ accountExpiryText }}</span>
          </div>
        </div>
      </header>
      
      <section class="viewport">
        <transition name="fade" mode="out-in">
          <DeviceList v-if="!showDeployPage && !showFilePage && !showMonitorPage && !showUserAdminPage && !showBatchPage && !showAdvancedPage && !showShareAdminPage" />
          <UserAdminPage v-else-if="showUserAdminPage" />
          <ShareAdminPage v-else-if="showShareAdminPage" />
          <DeployPage v-else-if="showDeployPage" />
          <FileManagerPage v-else-if="showFilePage" />
          <Dashboard v-else-if="showMonitorPage" />
          <BatchControlPage v-else-if="showBatchPage" />
          <AdvancedPage v-else-if="showAdvancedPage" />
        </transition>
      </section>

      <!-- Global bottom console drawer -->
      <div 
        class="global-console-container" 
        :class="{ 'nav-expanded': isNavExpanded && !isMobile }"
        v-show="deviceStore.showGlobalConsole"
        :style="{ height: deviceStore.globalConsoleHeight + 'px' }"
      >
        <DeviceConsole 
          v-if="deviceStore.consoleDeviceId"
          :key="deviceStore.consoleDeviceId"
          :deviceId="deviceStore.consoleDeviceId" 
          :height="deviceStore.globalConsoleHeight + 'px'" 
        />
      </div>
    </main>

    <!-- 3. Right control panel -->
    <aside 
      class="control-panel-wrapper" 
      :class="{ 
        'is-open': !!deviceStore.activeDeviceId && !showTerminalPage && !showDeployPage && !showMonitorPage && !(isMobile && showFilePage),
        'is-floating': isFloating && !isMobile,
        'is-mobile': isMobile
      }"
      :style="panelStyle"
    >
      <!-- Resize handle (docked) -->
      <div class="side-resizer" v-if="!isFloating && !isMobile" @mousedown="startResizing('left', $event)"></div>
      
      <!-- Floating resize handle -->
      <template v-if="isFloating && !isMobile">
        <div class="resize-handle top" @mousedown="startResizing('top', $event)"></div>
        <div class="resize-handle bottom" @mousedown="startResizing('bottom', $event)"></div>
        <div class="resize-handle left" @mousedown="startResizing('left', $event)"></div>
        <div class="resize-handle right" @mousedown="startResizing('right', $event)"></div>
        <div class="resize-corner bottom-right" @mousedown="startResizing('bottom-right', $event)"></div>
      </template>

      <!-- Panel content area -->
      <div class="panel-inner" v-if="deviceStore.activeDeviceIds.length > 0">
        <div class="panel-main">
           <!-- MultiDeviceContainer workspace -->
           <MultiDeviceContainer />
        </div>
      </div>

      <div class="panel-empty" v-else>
        <div class="hint-icon-wrapper">
          <svg class="hint-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
        </div>
        <p>Select a device on the left<br/>to start remote control</p>
      </div>
    </aside>

    <!-- 4. Mobile bottom navigation bar -->
    <nav class="mobile-bottom-nav" v-if="isMobile && (showFilePage || showTerminalPage || showDeployPage || showMonitorPage || showUserAdminPage || showBatchPage || showAdvancedPage || !deviceStore.activeDeviceId)">
      <button @click="navigateTo('/')" class="mobile-nav-item" :class="{ active: !showDeployPage && !showFilePage && !showTerminalPage && !showMonitorPage && !showUserAdminPage && !showBatchPage && !showAdvancedPage && !showShareAdminPage }">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        <span class="mobile-nav-text">Devices</span>
      </button>
      <button @click="navigateTo('/monitor')" class="mobile-nav-item" :class="{ active: showMonitorPage }">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <span class="mobile-nav-text">Dashboard</span>
      </button>
      <button @click="navigateTo('/batch')" class="mobile-nav-item" :class="{ active: showBatchPage }" v-if="authStore.isAdmin">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1"></rect>
          <rect x="14" y="3" width="7" height="5" rx="1"></rect>
          <rect x="14" y="12" width="7" height="9" rx="1"></rect>
          <rect x="3" y="16" width="7" height="5" rx="1"></rect>
        </svg>
        <span class="mobile-nav-text">Batch</span>
      </button>
      <button @click="navigateTo('/files')" class="mobile-nav-item" :class="{ active: showFilePage }">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="mobile-nav-text">Files</span>
      </button>
      <button @click="navigateTo('/terminal')" class="mobile-nav-item" :class="{ active: showTerminalPage }">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <span class="mobile-nav-text">Terminal</span>
      </button>
      <button @click="navigateTo('/admin')" class="mobile-nav-item" :class="{ active: showUserAdminPage }" v-if="authStore.role === 'admin'">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span class="mobile-nav-text">Users</span>
      </button>
    </nav>
    
    <!-- License Management Modal -->
    <LicensePanel :visible="showLicensePanel" @close="showLicensePanel = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDeviceStore } from '@/stores/devices'
import { useTagStore } from '@/stores/tags'
import { useAuthStore } from '@/stores/auth'
import DeviceClient from '@/views/DeviceClient.vue'
import DeviceList from '@/views/DeviceList.vue'
import DeployPage from '@/views/DeployPage.vue'
import FileManagerPage from '@/views/FileManagerPage.vue'
import DeviceConsole from '@/components/DeviceConsole.vue'
import Dashboard from '@/views/Dashboard.vue'
import Login from '@/views/Login.vue'
import UserAdminPage from '@/views/UserAdminPage.vue'
import BatchControlPage from '@/views/BatchControlPage.vue'
import AdvancedPage from '@/views/AdvancedPage.vue'
import ShareAdminPage from '@/views/ShareAdminPage.vue'
import LicensePanel from '@/components/LicensePanel.vue'
import MultiDeviceContainer from '@/components/multi/MultiDeviceContainer.vue'
import { useGroupControlStore } from '@/stores/groupControl'

const deviceStore = useDeviceStore()
const tagStore = useTagStore()
const authStore = useAuthStore()
const groupControlStore = useGroupControlStore()

const route = useRoute()
// /share guest route: renders router-view directly
const isSharePage = computed(() => route.path === '/share')

function handleLogout() {
  authStore.logout()
}

function toggleGroupControl() {
  groupControlStore.toggleGroupControl()
}

const systemVersion = ref('v0.1.9')
const fetchVersion = () => {
  fetch('/api/version')
    .then(res => res.json())
    .then(data => {
      if (data && data.version) {
        systemVersion.value = `${data.version} (${data.git_commit || ''})`
      }
    })
    .catch(err => console.warn('Failed to fetch system version:', err))
}

const isMobile = ref(window.innerWidth <= 1024)
const isFloating = ref(false)
const isResizing = ref(false)
const userAdjusted = ref(false)
const showDeployPage = ref(false)
const showFilePage = ref(false)
const showTerminalPage = ref(false)
const showMonitorPage = ref(false)
const showUserAdminPage = ref(false)
const showBatchPage = ref(false)
const showAdvancedPage = ref(false)
const showShareAdminPage = ref(false)
const isNavExpanded = ref(false)
const showHelpMenu = ref(false)
const activationKey = ref('')
const isActivating = ref(false)
const activationError = ref(null)
const copySuccess = ref(false)
const showLicensePanel = ref(false)
const showDisplayMenu = ref(false)
const topSearchInputRef = ref(null)

const isMainMatrixPage = computed(() => 
  !showDeployPage.value && 
  !showFilePage.value && 
  !showTerminalPage.value && 
  !showMonitorPage.value && 
  !showUserAdminPage.value && 
  !showBatchPage.value && 
  !showAdvancedPage.value && 
  !showShareAdminPage.value
)

function dispatchTopAction(action) {
  if (action === 'tag-manager') {
    window.dispatchEvent(new CustomEvent('open-tag-manager', { detail: { mode: 'full' } }))
  } else if (action === 'global-settings') {
    window.dispatchEvent(new CustomEvent('open-global-settings'))
  }
}

function onGlobalKeyDown(e) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    if (isMainMatrixPage.value && topSearchInputRef.value) {
      e.preventDefault()
      topSearchInputRef.value.focus()
      topSearchInputRef.value.select()
    }
  }
}

// Account validity duration
// nowTick runs every second to update countdown
const nowTick = ref(Date.now())
let expiryTimer = null

const accountExpiry = computed(() => {
  const p = authStore.userPolicy
  if (!p || !p.expires_at) return null
  const t = new Date(p.expires_at)
  if (Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return null
  return t
})
const accountExpired = computed(() => !!accountExpiry.value && accountExpiry.value.getTime() <= nowTick.value)
const accountExpiryText = computed(() => {
  const t = accountExpiry.value
  if (!t) return ''
  const ms = t.getTime() - nowTick.value
  if (ms <= 0) return 'Expired'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000).toString().padStart(2, '0')
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0')
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
  return d > 0 ? `${d}d ${h}:${m}:${s}` : `${h}:${m}:${s}`
})

function copyMachineID() {
  if (!deviceStore.globalMachineID) return
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(deviceStore.globalMachineID)
      .then(() => {
        copySuccess.value = true
        setTimeout(() => { copySuccess.value = false }, 2000)
      })
      .catch(err => {
        console.error('Failed to copy machine ID:', err)
      })
  }
}

async function submitActivation() {
  if (!activationKey.value.trim()) return
  isActivating.value = true
  activationError.value = null
  
  const res = await deviceStore.activateLicense(activationKey.value.trim())
  isActivating.value = false
  if (res.success) {
    activationKey.value = ''
    alert('System activation successful! License reloaded and applied immediately.')
  } else {
    activationError.value = res.error
  }
}

const floatPos = ref({ x: 100, y: 100 })
const floatSize = ref({ w: 600, h: 800 })
const sideWidth = ref(420)

// Dynamic style calculation
const panelStyle = computed(() => {
  if (isMobile.value) return {}
  // Hide panel when closed or in fullscreen pages
  if (deviceStore.activeDeviceIds.length === 0 || showTerminalPage.value || showDeployPage.value || showMonitorPage.value) {
    return { width: '0px', display: 'none' }
  }
  const isMulti = deviceStore.activeDeviceIds.length > 1
  if (isFloating.value) {
    const defaultMultiW = Math.min(window.innerWidth * 0.85, 1080)
    const defaultMultiH = Math.min(window.innerHeight * 0.88, 850)
    return {
      position: 'fixed',
      left: `${floatPos.value.x}px`,
      top: `${floatPos.value.y}px`,
      width: `${isMulti && !userAdjusted.value ? defaultMultiW : floatSize.value.w}px`,
      height: `${isMulti && !userAdjusted.value ? defaultMultiH : floatSize.value.h}px`,
      transform: 'none'
    }
  }
  const defaultSideW = isMulti && !userAdjusted.value ? Math.min(window.innerWidth * 0.65, 880) : sideWidth.value
  return { width: `${defaultSideW}px` }
})

// Handle subcomponent layout suggestions
function handleRecommendLayout({ isLandscape, ratio }) {
  if (isMobile.value || userAdjusted.value) return
  
  if (isFloating.value) {
    const targetW = isLandscape ? Math.min(window.innerWidth * 0.7, 900) : 500
    const targetH = targetW / ratio
    floatSize.value = { w: targetW, h: Math.min(targetH, window.innerHeight * 0.85) }
  } else {
    if (isLandscape) {
      sideWidth.value = Math.min(window.innerWidth * 0.7, window.innerHeight * ratio + 40)
    } else {
      sideWidth.value = 420
    }
  }
}

function toggleFloating() {
  if (!isFloating.value) {
    floatPos.value = { x: window.innerWidth - floatSize.value.w - 40, y: 80 }
  }
  isFloating.value = !isFloating.value
}

// Dragging logic
let dragOffset = { x: 0, y: 0 }
function startDragging(e) {
  if (!isFloating.value || isMobile.value) return
  isResizing.value = true
  dragOffset = { x: e.clientX - floatPos.value.x, y: e.clientY - floatPos.value.y }
  const onMove = (ev) => {
    floatPos.value.x = ev.clientX - dragOffset.x
    floatPos.value.y = ev.clientY - dragOffset.y
  }
  const onUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
}

// Resizing logic
function startResizing(type, e) {
  e.preventDefault(); e.stopPropagation()
  isResizing.value = true; userAdjusted.value = true
  const initial = { 
    x: floatPos.value.x, y: floatPos.value.y, 
    w: floatSize.value.w, h: floatSize.value.h, 
    sw: sideWidth.value, px: e.clientX, py: e.clientY 
  }
  const onMove = (ev) => {
    const dx = ev.clientX - initial.px, dy = ev.clientY - initial.py
    if (!isFloating.value) {
      const newWidth = initial.sw - dx
      if (newWidth > 300 && newWidth < window.innerWidth * 0.9) sideWidth.value = newWidth
      return
    }
    if (type.includes('right')) floatSize.value.w = Math.max(300, initial.w + dx)
    if (type.includes('left')) { const newW = initial.w - dx; if (newW > 300) { floatSize.value.w = newW; floatPos.value.x = initial.x + dx } }
    if (type.includes('bottom')) floatSize.value.h = Math.max(300, initial.h + dy)
    if (type.includes('top')) { const newH = initial.h - dy; if (newH > 300) { floatSize.value.h = newH; floatPos.value.y = initial.y + dy } }
  }
  const onUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
}

const updateMedia = () => {
  isMobile.value = window.innerWidth <= 1024
  if (isMobile.value) isFloating.value = false
}

function openTagManager() {
  window.dispatchEvent(new CustomEvent('cloudphone-open-tag-manager'))
}

function toggleTag(tagId) {
  tagStore.toggleSelectedTag(tagId)
  // Clear special filter when tag selected
  deviceStore.showOfflineOnly = false
  deviceStore.showRecentOnly = false
}

function selectAllDevices() {
  tagStore.clearSelectedTags()
  deviceStore.showOfflineOnly = false
  deviceStore.showRecentOnly = false
}

function toggleOfflineView() {
  deviceStore.showOfflineOnly = !deviceStore.showOfflineOnly
  if (deviceStore.showOfflineOnly) {
    // Mutually exclusive offline and tag filters
    tagStore.clearSelectedTags()
    deviceStore.showRecentOnly = false
  }
}

function toggleRecentView() {
  deviceStore.showRecentOnly = !deviceStore.showRecentOnly
  if (deviceStore.showRecentOnly) {
    // Mutually exclusive recent and tag filters
    tagStore.clearSelectedTags()
    deviceStore.showOfflineOnly = false
  }
}

function getTagDeviceCount(tagId) {
  return deviceStore.devices.filter(device => tagStore.getTagIdsForDevice(device.id).includes(tagId)).length
}

const initApp = () => {
  if (authStore.isLoggedIn && !isSharePage.value) {
    authStore.fetchMe()
    tagStore.load()
    deviceStore.fetchDevices()
    deviceStore.initSignaling()
    deviceStore.fetchLicenseStatus()
    
    // Fetch backend default settings
    fetch('/api/default_settings')
      .then(res => res.json())
      .then(config => {
        if (config && typeof config === 'object' && Object.keys(config).length > 0) {
          const stored = localStorage.getItem('cloudphone_settings')
          let current = {}
          if (stored) {
            try {
              current = JSON.parse(stored)
            } catch(e) {}
          }
          const merged = { ...current, ...config }
          localStorage.setItem('cloudphone_settings', JSON.stringify(merged))
          window.dispatchEvent(new CustomEvent('cloudphone-settings-updated', { detail: { deviceId: '' } }))
        }
      })
      .catch(err => console.warn('Could not fetch backend default settings:', err))
  }
}

const closeHelpMenu = () => {
  showHelpMenu.value = false
}

const onWindowClick = () => {
  showHelpMenu.value = false
  showDisplayMenu.value = false
}

const handleNavigateEvent = (e) => {
  if (e && e.detail) {
    navigateTo(e.detail)
  }
}

onMounted(async () => {
  await authStore.checkNoAuthStatus()
  initApp()
  fetchVersion()
  // Fetch current user policy and expiration
  if (authStore.token && !authStore.userPolicy) {
    authStore.fetchMe()
  }
  expiryTimer = setInterval(() => { nowTick.value = Date.now() }, 1000)
  window.addEventListener('resize', updateMedia)
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onGlobalKeyDown)
  window.addEventListener('cloudphone-navigate', handleNavigateEvent)
  updateMedia() // Trigger initial viewport check
})

watch(() => authStore.isLoggedIn, (newVal) => {
  if (newVal) {
    initApp()
  }
})
onUnmounted(() => {
  if (expiryTimer) clearInterval(expiryTimer)
  window.removeEventListener('resize', updateMedia)
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onGlobalKeyDown)
  window.removeEventListener('cloudphone-navigate', handleNavigateEvent)
})

watch(() => deviceStore.activeDeviceId, (newId) => {
  if (!newId) {
    isFloating.value = false; userAdjusted.value = false
  }
})

function closePanel() {
  deviceStore.clearActiveDevice()
}

function navigateTo(path) {
  // Restrict pages for standard users
  if (!authStore.isAdmin && (path === '/shares' || path === '/batch')) {
    path = '/'
  }
  // Reset share page flags
  showShareAdminPage.value = false

  if (path === '/shares') {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showBatchPage.value = false
    showUserAdminPage.value = false
    showAdvancedPage.value = false
    showShareAdminPage.value = true
  } else if (path === '/deploy') {
    showDeployPage.value = true
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showBatchPage.value = false
    showUserAdminPage.value = false
    showAdvancedPage.value = false
  } else if (path === '/files') {
    showDeployPage.value = false
    showFilePage.value = true
    showTerminalPage.value = false
    showMonitorPage.value = false
    showBatchPage.value = false
    showUserAdminPage.value = false
    showAdvancedPage.value = false
  } else if (path === '/terminal') {
    // Toggle terminal drawer on click
    deviceStore.toggleGlobalConsole()
  } else if (path === '/monitor') {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = true
    showBatchPage.value = false
    showUserAdminPage.value = false
    showAdvancedPage.value = false
  } else if (path === '/batch') {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showBatchPage.value = true
    showUserAdminPage.value = false
    showAdvancedPage.value = false
  } else if (path === '/admin') {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showBatchPage.value = false
    showUserAdminPage.value = true
    showAdvancedPage.value = false
  } else if (path === '/advanced') {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showBatchPage.value = false
    showUserAdminPage.value = false
    showAdvancedPage.value = true
  } else {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showBatchPage.value = false
    showUserAdminPage.value = false
    showAdvancedPage.value = false
  }
}
</script>

<style>
:root { --nav-width: 64px; --bg-primary: #0d1117; --bg-secondary: #161b22; --border: #30363d; --accent: #58a6ff; }
body { margin: 0; background: var(--bg-primary); color: #c9d1d9; font-family: -apple-system, sans-serif; overflow: hidden; height: 100vh; height: 100dvh; }

.app-container { display: flex; height: 100vh; height: 100dvh; width: 100vw; position: relative; }
.is-resizing * { transition: none !important; user-select: none !important; }

.side-nav { 
  width: var(--nav-width); 
  background: var(--bg-secondary); 
  border-right: 1px solid var(--border); 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  padding: 20px 0; 
  flex-shrink: 0; 
  box-sizing: border-box;
  transition: width 0.22s ease;
}

.nav-version {
  margin-top: auto;
  font-size: 11px;
  color: #8b949e;
  opacity: 0.45;
  text-align: center;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 8px 4px 0 4px;
  box-sizing: border-box;
  transition: opacity 0.2s;
  cursor: default;
}

.nav-version:hover {
  opacity: 0.9;
}

.side-nav.expanded {
  width: 180px;
  align-items: stretch;
  padding-left: 12px;
  padding-right: 12px;
}

.nav-brand { 
  width: 40px;
  min-height: 40px;
  margin-bottom: 40px; 
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: inherit;
  background: transparent;
  border-radius: 12px;
  align-self: center;
  overflow: hidden;
  position: relative;
  transition: background 0.2s;
}

/* Collapse indicator */
.nav-brand-collapse-arrow {
  display: none;
  margin-left: auto;
  align-items: center;
  justify-content: center;
  color: #8b949e;
  opacity: 0.4;
  transition: opacity 0.2s;
  cursor: pointer;
}

.nav-brand-collapse-arrow svg {
  width: 14px;
  height: 14px;
}

.side-nav.expanded .nav-brand-collapse-arrow {
  display: inline-flex;
}

.nav-brand:hover .nav-brand-collapse-arrow {
  opacity: 0.9;
}

/* Tooltip bubble */
.side-nav:not(.expanded) .nav-brand {
  overflow: visible;
}

.side-nav:not(.expanded) .nav-brand::after {
  content: "Expand Sidebar";
  position: absolute;
  left: 52px;
  top: 50%;
  transform: translateY(-50%);
  background: #1f2937;
  color: #e5e7eb;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid #374151;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.side-nav:not(.expanded) .nav-brand::before {
  content: "";
  position: absolute;
  left: 46px;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-right-color: #1f2937;
  z-index: 999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.side-nav:not(.expanded) .nav-brand:hover::after,
.side-nav:not(.expanded) .nav-brand:hover::before {
  opacity: 1;
}

.side-nav.expanded .nav-brand {
  width: 100%;
  justify-content: flex-start;
  padding: 0 8px;
}

.nav-brand:hover {
  background: rgba(255,255,255,0.05);
}

.nav-brand-icon-svg {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  color: var(--accent, #58a6ff);
}

.nav-brand-text,
.nav-item-text,
.nav-tag-name,
.nav-tag-count,
.manage-text {
  display: none;
}

.side-nav.expanded .nav-brand-text,
.side-nav.expanded .nav-item-text,
.side-nav.expanded .nav-tag-name,
.side-nav.expanded .nav-tag-count,
.side-nav.expanded .manage-text {
  display: inline-flex;
}

.nav-brand-text {
  font-size: 14px;
  font-weight: 700;
  color: #e6edf3;
  white-space: nowrap;
}

.nav-links { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  width: 100%;
}

.side-nav.expanded .nav-links {
  align-items: stretch;
}

.nav-item { 
  min-height: 40px;
  padding: 0 10px; 
  border-radius: 12px; 
  margin-bottom: 20px; 
  opacity: 0.5; 
  text-decoration: none; 
  color: inherit; 
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  overflow: hidden;
  white-space: nowrap;
}

.side-nav.expanded .nav-item {
  justify-content: flex-start;
  margin-bottom: 8px;
}

.nav-item-icon-svg {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
}

.nav-item-text {
  font-size: 13px;
  font-weight: 700;
}

.nav-item.active { opacity: 1; color: var(--accent); background: rgba(88,166,255,0.1); }
.nav-item.logout-nav-item:hover { opacity: 1; color: #f85149; background: rgba(248,81,73,0.1); }

/* Header account expiration countdown */
.expiry-chip {
  margin-left: 8px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  user-select: none;
}

.expiry-chip.expired {
  background: rgba(248, 81, 73, 0.12);
  border-color: rgba(248, 81, 73, 0.35);
  color: #f85149;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-help-menu {
  position: relative;
  display: flex;
  align-items: center;
}

.help-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.help-btn:hover, .help-btn.active {
  color: var(--accent);
  background: rgba(88, 166, 255, 0.08);
}

.help-icon-svg {
  width: 20px;
  height: 20px;
}

.help-dropdown {
  position: absolute;
  top: 40px;
  right: 0;
  width: 280px;
  background: #161b22;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  overflow: hidden;
  padding: 4px 0;
}

.help-dropdown-header {
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 600;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}

.help-dropdown-list {
  display: flex;
  flex-direction: column;
}

.help-dropdown-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  text-decoration: none;
  color: #c9d1d9;
  transition: background 0.2s ease;
}

.help-dropdown-item:hover {
  background: rgba(88, 166, 255, 0.08);
}

.help-dropdown-item .dropdown-icon {
  width: 18px;
  height: 18px;
  color: #8b949e;
  margin-top: 2px;
  flex-shrink: 0;
}

.help-dropdown-item:hover .dropdown-icon {
  color: var(--accent);
}

.help-dropdown-item .item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.help-dropdown-item .item-title {
  font-size: 13px;
  font-weight: 600;
  color: #e6edf3;
}

.help-dropdown-item .item-desc {
  font-size: 11px;
  color: #8b949e;
  line-height: 1.4;
}

.pop-enter-active, .pop-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.pop-enter-from, .pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* Fade animation */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.header-user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #58a6ff, #1f6feb);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(31, 111, 235, 0.3);
  flex-shrink: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #e6edf3;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-role-badge.admin {
  background: rgba(242, 193, 46, 0.12);
  color: #f2c12e;
  border: 1px solid rgba(242, 193, 46, 0.25);
}

.user-role-badge.user {
  background: rgba(88, 166, 255, 0.12);
  color: #58a6ff;
  border: 1px solid rgba(88, 166, 255, 0.25);
}

.nav-tag-group {
  width: 100%;
  min-height: 0;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.side-nav.expanded .nav-tag-group {
  align-items: stretch;
}

.nav-tag-group-title {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #8b949e;
  font-size: 11px;
  font-weight: 700;
}

.side-nav.expanded .nav-tag-group-title {
  flex-direction: row;
  justify-content: space-between;
}

.nav-tag-manage-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 18px;
  line-height: 1;
  gap: 6px;
}

.side-nav.expanded .nav-tag-manage-btn {
  width: auto;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
}

.manage-plus {
  font-size: 18px;
  line-height: 1;
}

.nav-tag-manage-btn:hover {
  color: #fff;
  background: rgba(88,166,255,0.12);
  border-color: rgba(88,166,255,0.4);
}

.nav-tag-list {
  width: 100%;
  min-height: 0;
  margin-top: 12px;
  padding: 0 0 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  overflow-y: auto;
}

.side-nav.expanded .nav-tag-list {
  align-items: stretch;
}

.nav-tag-list::-webkit-scrollbar {
  width: 0;
}

.nav-tag-item {
  width: 36px;
  height: 36px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  opacity: 0.75;
  color: #c9d1d9;
  overflow: hidden;
}

.side-nav.expanded .nav-tag-item {
  width: 100%;
  justify-content: flex-start;
  padding: 0 8px;
}

.nav-tag-item:hover,
.nav-tag-item.active {
  opacity: 1;
  background: rgba(88,166,255,0.1);
  border-color: rgba(88,166,255,0.25);
}

.nav-tag-dot {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.06);
}

.nav-tag-dot.all {
  background: var(--accent);
}

.nav-tag-dot.offline {
  background: #8b949e;
}

.nav-tag-dot.recent {
  background: #4ade80;
}

.offline-tag-item {
  margin-top: 4px;
  border-top: 1px dashed var(--border);
  border-radius: 0 0 6px 6px;
}

.nav-tag-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
}

.nav-tag-count {
  min-width: 22px;
  justify-content: center;
  padding: 1px 6px;
  border-radius: 999px;
  color: #8b949e;
  background: rgba(255,255,255,0.08);
  font-size: 11px;
}

.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.top-bar {
  height: 56px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
  gap: 16px;
  position: relative;
  z-index: 150;
  flex-shrink: 0;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #e6edf3;
  white-space: nowrap;
}

.top-device-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  white-space: nowrap;
}

.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.license-badge-top {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #30363d;
  background: rgba(139, 148, 158, 0.08);
  color: #8b949e;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.license-badge-top:hover {
  border-color: #8b949e;
  color: #c9d1d9;
}

.license-badge-top.badge-warn {
  color: #d29922;
  background: rgba(210, 153, 34, 0.1);
  border-color: rgba(210, 153, 34, 0.4);
}

.license-badge-top.badge-danger {
  color: #f85149;
  background: rgba(248, 81, 73, 0.1);
  border-color: rgba(248, 81, 73, 0.4);
}

.license-badge-top.badge-enterprise {
  color: #3fb950;
  background: rgba(63, 185, 80, 0.12);
  border-color: rgba(63, 185, 80, 0.4);
}

/* Centered search bar */
.top-bar-center {
  flex: 1;
  max-width: 440px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
}

.top-bar-center-placeholder {
  flex: 1;
}

.top-search-box {
  width: 100%;
  height: 34px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 8px;
  transition: all 0.2s ease;
}

.top-search-box:focus-within {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.07);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
}

.search-icon {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.top-search-box input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  min-width: 0;
}

.top-search-box input::placeholder {
  color: var(--text-secondary);
  font-size: 12px;
}

.clear-search-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-search-btn svg {
  width: 13px;
  height: 13px;
}

.search-shortcut-badge {
  font-size: 10px;
  font-family: inherit;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
  line-height: 1;
}

/* Header right */
.top-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.top-matrix-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.top-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 9px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 7px;
  color: #c9d1d9;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.top-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.top-action-btn.active {
  background: rgba(88, 166, 255, 0.15);
  border-color: rgba(88, 166, 255, 0.4);
  color: var(--accent);
}

.top-action-btn.primary-action-btn {
  background: rgba(88, 166, 255, 0.1);
  border-color: rgba(88, 166, 255, 0.3);
  color: #58a6ff;
}

.top-action-btn.primary-action-btn:hover {
  background: rgba(88, 166, 255, 0.2);
  border-color: rgba(88, 166, 255, 0.5);
}

.action-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.top-bar-divider {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 4px;
}

/* Display settings dropdown */
.top-dropdown-wrap {
  position: relative;
}

.display-dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 230px;
  background: #1c2128;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dropdown-panel-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #8b949e;
  letter-spacing: 0.5px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #c9d1d9;
  cursor: pointer;
}

.switch-row.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.switch-input {
  cursor: pointer;
}

.dropdown-divider {
  height: 1px;
  background: #30363d;
  margin: 2px 0;
}

.dropdown-slider-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8b949e;
}

.slider-val {
  color: #58a6ff;
  font-weight: 600;
}

.preset-density-row {
  display: flex;
  gap: 4px;
  margin: 2px 0 6px 0;
}

.preset-density-btn {
  flex: 1;
  padding: 4px 0;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-density-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #c9d1d9;
}

.preset-density-btn.active {
  background: rgba(56, 139, 253, 0.15);
  border-color: #388bfd;
  color: #58a6ff;
  font-weight: 700;
}

.card-slider-input {
  width: 100%;
  accent-color: var(--accent);
}

.dropdown-view-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 4px;
}

.view-toggle-opt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.view-toggle-opt svg {
  width: 13px;
  height: 13px;
}

.view-toggle-opt:hover {
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.08);
}

.view-toggle-opt.active {
  background: rgba(88, 166, 255, 0.15);
  border-color: #58a6ff;
  color: #58a6ff;
  font-weight: 600;
}

/* Multi-device quick select panel */
.multi-select-dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 270px;
  background: #1c2128;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.multi-select-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid #30363d;
}

.multi-select-header .panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
}

.header-tools {
  display: flex;
  gap: 8px;
}

.text-tool-btn {
  background: none;
  border: none;
  color: #58a6ff;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}

.text-tool-btn:hover {
  text-decoration: underline;
}

.multi-select-list {
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
}

.multi-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #c9d1d9;
  transition: background 0.15s;
}

.multi-select-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.select-checkbox {
  accent-color: var(--accent);
  cursor: pointer;
}

.item-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

.item-id {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-model {
  font-size: 10px;
  color: #8b949e;
}

.multi-select-empty {
  font-size: 12px;
  color: #8b949e;
  text-align: center;
  padding: 16px 0;
}

.multi-select-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #30363d;
}

.disconnect-all-btn {
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid rgba(248, 81, 73, 0.3);
  color: #f85149;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
}

.disconnect-all-btn:hover {
  background: rgba(248, 81, 73, 0.2);
}

.start-multi-btn {
  background: #238636;
  border: 1px solid #2ea44f;
  color: #fff;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.start-multi-btn:hover:not(:disabled) {
  background: #2ea44f;
}

.start-multi-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.global-status { color: #888; font-size: 13px; }
.viewport { flex: 1; overflow-y: auto; padding: 12px; }

/* Sidebar panel container */
.control-panel-wrapper {
  height: 100vh; background: var(--bg-secondary); border-left: 0px solid var(--border);
  display: flex; flex-direction: column; position: relative; z-index: 200;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-left-width 0.3s ease;
  width: 0; /* Width is 0 when closed */
  overflow: hidden;
}
.control-panel-wrapper.is-open { 
  border-left: 1px solid var(--border);
  /* Width controlled by panelStyle */
}

/* Floating mode */
.control-panel-wrapper.is-floating {
  position: fixed; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 30px 60px rgba(0,0,0,0.6); z-index: 1000; transform: none; transition: none;
}

/* Resize handle */
.side-resizer { position: absolute; left: -4px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 100; }
.resize-handle { position: absolute; z-index: 100; }
.resize-handle.top { top: -5px; left: 0; right: 0; height: 10px; cursor: ns-resize; }
.resize-handle.bottom { bottom: -5px; left: 0; right: 0; height: 10px; cursor: ns-resize; }
.resize-handle.left { left: -5px; top: 0; bottom: 0; width: 10px; cursor: ew-resize; }
.resize-handle.right { right: -5px; top: 0; bottom: 0; width: 10px; cursor: ew-resize; }
.resize-corner.bottom-right { position: absolute; right: -5px; bottom: -5px; width: 20px; height: 20px; cursor: nwse-resize; z-index: 101; }

.panel-inner { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-secondary); border-radius: 12px; }
.panel-top-bar { height: 50px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); cursor: grab; }
.vm-info { display: flex; align-items: center; gap: 8px; pointer-events: none; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
.vm-id { font-weight: 600; font-size: 14px; }
.tool-btn { background: none; border: none; color: #8b949e; cursor: pointer; padding: 6px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
.tool-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
.tool-btn.close:hover { color: #f85149; }
.tool-btn-svg { width: 16px; height: 16px; }

.panel-main { flex: 1; overflow: hidden; background: #000; }

.panel-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #888; text-align: center; opacity: 0.3; }
.hint-icon-wrapper { margin-bottom: 16px; display: flex; align-items: center; justify-content: center; }
.hint-icon-svg { width: 48px; height: 48px; color: #8b949e; }

/* Mobile responsive */
@media (max-width: 1024px) {
  .app-container { flex-direction: column; }
  .control-panel-wrapper.is-mobile { 
    position: fixed; 
    inset: 0; 
    width: 100vw !important; 
    height: 100dvh !important; 
    transform: translateX(100%); 
    z-index: 2000; 
    border: none;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    box-sizing: border-box;
    background: #000;
  }
  .control-panel-wrapper.is-mobile.is-open { transform: translateX(0); }
  .panel-inner { border-radius: 0; }
}

/* Mobile bottom nav */
.mobile-bottom-nav {
  height: 60px;
  width: 100%;
  flex-shrink: 0;
  background: var(--bg-secondary, #161b22);
  border-top: 1px solid var(--border, #30363d);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #8b949e;
  font-size: 11px;
  cursor: pointer;
  flex: 1;
  height: 100%;
  transition: all 0.2s ease;
  gap: 4px;
}

.mobile-nav-item:active {
  background: rgba(255, 255, 255, 0.05);
}

.mobile-nav-icon-svg {
  width: 20px;
  height: 20px;
}

.mobile-nav-text {
  font-weight: 600;
  font-size: 10px;
}

.mobile-nav-item.active {
  color: var(--accent, #58a6ff);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.global-console-container {
  position: fixed;
  bottom: 0;
  left: var(--nav-width, 64px);
  right: 0;
  z-index: 1000;
  transition: left 0.22s ease;
  box-sizing: border-box;
}

.global-console-container.nav-expanded {
  left: 180px;
}

@media (max-width: 1024px) {
  .global-console-container {
    left: 0 !important;
  }
}

/* Global license expired overlay */
.license-block-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(10, 12, 16, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.license-block-card {
  width: 500px;
  max-width: 90%;
  background: #161b22;
  border: 1px solid #f85149;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
}

.license-block-header {
  text-align: center;
  margin-bottom: 24px;
}

.license-alert-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.license-block-header h2 {
  margin: 0 0 8px 0;
  color: #f85149;
  font-size: 22px;
}

.license-block-subtitle {
  margin: 0;
  color: #8b949e;
  font-size: 14px;
}

.license-block-body {
  margin-bottom: 24px;
}

.license-error-tip {
  background: rgba(248, 81, 73, 0.1);
  color: #f85149;
  border: 1px solid rgba(248, 81, 73, 0.2);
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  margin: 0 0 20px 0;
  line-height: 1.5;
  text-align: center;
}

.license-info-row {
  margin-bottom: 16px;
}

.info-label {
  display: block;
  font-size: 13px;
  color: #8b949e;
  margin-bottom: 6px;
}

.machine-id-container {
  display: flex;
  gap: 8px;
}

.machine-id-container code {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 12px;
  font-family: monospace;
  font-size: 14px;
  color: #c9d1d9;
  display: flex;
  align-items: center;
  overflow-x: auto;
}

.copy-code-btn {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  cursor: pointer;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s;
}

.copy-code-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.license-input-group {
  margin-bottom: 20px;
}

.license-input-group label {
  display: block;
  font-size: 13px;
  color: #8b949e;
  margin-bottom: 6px;
}

.license-input-group textarea {
  width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-family: monospace;
  font-size: 12px;
  padding: 10px;
  box-sizing: border-box;
  resize: none;
  outline: none;
}

.license-input-group textarea:focus {
  border-color: var(--accent);
}

.activate-btn {
  width: 100%;
  background: #238636;
  border: 1px solid #2ea44f;
  border-radius: 6px;
  color: #ffffff;
  padding: 10px 16px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.activate-btn:hover:not(:disabled) {
  background: #2ea44f;
}

.activate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.activation-error-msg {
  color: #f85149;
  background: rgba(248, 81, 73, 0.05);
  border: 1px solid rgba(248, 81, 73, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 16px;
  text-align: center;
}

.license-block-footer {
  border-top: 1px solid #30363d;
  padding-top: 16px;
  font-size: 12px;
  color: #8b949e;
  text-align: center;
}

.license-block-footer p {
  margin: 0 0 8px 0;
}

.contact-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.footer-email {
  color: var(--accent);
  text-decoration: none;
}

.footer-purchase-link {
  color: #d29922;
  font-weight: 600;
  text-decoration: none;
}

.footer-purchase-link:hover {
  text-decoration: underline;
}

.footer-email:hover, .footer-contact-link:hover {
  text-decoration: underline;
}

.footer-divider {
  color: #30363d;
}

.footer-contact-link {
  color: #8b949e;
  text-decoration: none;
}
</style>
