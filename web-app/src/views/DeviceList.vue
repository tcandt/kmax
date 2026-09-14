<template>
  <div class="device-list-page">
    <!-- Mobile compact header: Two rows of high-density controls (Desktop merged into global topbar) -->
    <header v-if="isMobile" class="page-header mobile-header">
      <!-- Single-line compact header: Batch (admin) / Tags / Sort / Grid / Search / Refresh / Toggle View -->
      <div class="mh-row">
        <!-- Batch operations popup (admin only): Group control + Preview toggle + Tag manager / Global settings -->
        <div v-if="authStore.isAdmin" class="mh-dropdown">
          <button class="mh-filter-btn" @click.stop="toggleMobileMenu('batch')">☰ Batch ▾</button>
          <div v-if="mobileOpenMenu === 'batch'" class="mh-panel" @click.stop>
            <button class="mh-panel-item" @click="toggleMobileGroupControl">
              {{ groupControlStore.isGroupControlActive ? 'Exit Group Control' : 'Enter Group Control' }}
            </button>
            <!-- Group control shortcuts (equivalent to desktop group control toolbar) -->
            <template v-if="groupControlStore.isGroupControlActive">
              <button class="mh-panel-item" @click.stop="selectAllOnline">Select All Online</button>
              <button class="mh-panel-item" @click.stop="clearSlaves">Clear Selected</button>
              <div class="tag-select-dropdown">
                <button class="mh-panel-item dropdown-trigger" @click.stop="showTagDropdown = !showTagDropdown">
                  Select by Tag ▾
                </button>
                <div v-if="showTagDropdown" class="tag-dropdown-menu" @click.stop>
                  <div
                    v-for="tag in tagStore.tags"
                    :key="tag.id"
                    class="tag-dropdown-item"
                    @click="selectByTag(tag.id)"
                  >
                    <span class="tag-color-dot" :style="{ backgroundColor: tag.color }"></span>
                    <span class="tag-name-text">{{ tag.name }}</span>
                  </div>
                  <div v-if="tagStore.tags.length === 0" class="tag-dropdown-empty">No tags</div>
                </div>
              </div>
              <div class="mh-panel-static">Selected {{ groupControlStore.selectedSlaveIds.length }} devices</div>
              <button
                v-if="groupControlStore.selectedSlaveIds.length > 0"
                class="mh-panel-item"
                @click="openTagManager('batch'); closeMobileMenus()"
              >Batch Tag</button>
            </template>
            <div class="mh-panel-divider"></div>
            <!-- High-FPS preview / Interactive preview toggles -->
            <label class="switch-label mh-switch" title="When enabled, visible devices will use WebCodecs hardware acceleration for real-time 10fps preview">
              <input
                type="checkbox"
                v-model="deviceStore.globalPreviewMode"
                class="switch-checkbox"
              >
              <span class="switch-text">High-FPS Preview</span>
            </label>
            <label
              class="switch-label mh-switch"
              :class="{ 'disabled': !deviceStore.globalPreviewMode }"
              title="When enabled, click directly on preview screen to touch and control without entering details (requires High-FPS Preview)"
            >
              <input
                type="checkbox"
                v-model="deviceStore.globalInteractiveMode"
                :disabled="!deviceStore.globalPreviewMode"
                class="switch-checkbox"
              >
              <span class="switch-text">Interactive Preview</span>
            </label>
            <div class="mh-panel-divider"></div>
            <button class="mh-panel-item" @click="openTagManager('full'); closeMobileMenus()">Tag Manager</button>
            <button class="mh-panel-item" @click="openGlobalSettings(); closeMobileMenus()">Global Settings</button>
            <button class="mh-panel-item" @click="showLicensePanel = true; closeMobileMenus()">License Management</button>
          </div>
        </div>
        <!-- Tag filter (All / Tags / Offline) -->
        <div class="mh-dropdown">
          <button
            class="mh-filter-btn"
            :class="{ active: tagStore.selectedTagIds.length > 0 || deviceStore.showOfflineOnly }"
            @click.stop="toggleMobileMenu('tag')"
          >Tags ▾</button>
          <div v-if="mobileOpenMenu === 'tag'" class="mh-panel" @click.stop>
            <button
              class="mh-panel-item"
              :class="{ active: tagStore.selectedTagIds.length === 0 && !deviceStore.showOfflineOnly }"
              @click="selectAllTags(); closeMobileMenus()"
            >
              <span class="tag-dot all"></span>
              <span class="mh-item-name">All Devices</span>
              <span class="mh-item-count">{{ deviceStore.devices.length }}</span>
            </button>
            <button
              v-for="tag in tagStore.tags"
              :key="tag.id"
              class="mh-panel-item"
              :class="{ active: tagStore.selectedTagIds.includes(tag.id) }"
              @click="toggleSelectedTag(tag.id); closeMobileMenus()"
            >
              <span class="tag-dot" :style="{ background: tag.color }"></span>
              <span class="mh-item-name">{{ tag.name }}</span>
              <span class="mh-item-count">{{ getTagDeviceCount(tag.id) }}</span>
            </button>
            <button
              class="mh-panel-item"
              :class="{ active: deviceStore.showOfflineOnly }"
              @click="toggleOfflineView(); closeMobileMenus()"
            >
              <span class="tag-dot offline"></span>
              <span class="mh-item-name">Offline Devices</span>
              <span class="mh-item-count">{{ deviceStore.offlineDevices.length }}</span>
            </button>
            <!-- Non-admin tag/license manager access -->
            <template v-if="!authStore.isAdmin">
              <div class="mh-panel-divider"></div>
              <button class="mh-panel-item" @click="openTagManager('full'); closeMobileMenus()">Tag Manager</button>
              <button class="mh-panel-item" @click="showLicensePanel = true; closeMobileMenus()">License Management</button>
            </template>
          </div>
        </div>
        <!-- Sort -->
        <div class="mh-dropdown">
          <button class="mh-filter-btn" :class="{ active: sortBy !== 'default' }" @click.stop="toggleMobileMenu('sort')">Sort ▾</button>
          <div v-if="mobileOpenMenu === 'sort'" class="mh-panel" @click.stop>
            <button class="mh-panel-item" :class="{ active: sortBy === 'default' }" @click="setSortBy('default')">Default Order</button>
            <button class="mh-panel-item" :class="{ active: sortBy === 'recent' }" @click="setSortBy('recent')">Recently Active</button>
          </div>
        </div>
        <!-- Grid columns (right-aligned dropdown) -->
        <div class="mh-dropdown drop-right">
          <button class="mh-filter-btn" @click.stop="toggleMobileMenu('cols')">Grid ▾</button>
          <div v-if="mobileOpenMenu === 'cols'" class="mh-panel" @click.stop>
            <button
              v-for="n in [2, 3, 4]"
              :key="n"
              class="mh-panel-item"
              :class="{ active: mobileCols === n }"
              @click="setMobileCols(n)"
            >{{ n }} Cols</button>
          </div>
        </div>
        <!-- Account remaining time -->
        <span
          v-if="accountExpiryChip"
          class="mh-expiry-chip"
          :class="{ expired: accountExpired }"
          :title="accountExpiryTime ? 'Account Expiration: ' + accountExpiryTime.toLocaleString('en-US', { hour12: false }) : ''"
        >⏳ {{ accountExpiryChip }}</span>
        <div class="mh-actions">
          <button class="mh-icon-btn" :class="{ active: showMobileSearch }" @mousedown.prevent @click.stop="toggleMobileSearch" title="Search" aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="M20 20l-4-4"></path>
            </svg>
          </button>
          <button class="mh-icon-btn" @click="refreshDevices" title="Refresh device list" aria-label="Refresh">⟳</button>
          <button class="mh-icon-btn" @click="toggleViewMode" :title="viewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'" aria-label="Toggle View">
            <svg v-if="viewMode === 'grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>
        </div>
      </div>

      <!-- Search expanded state: Full width input -->
      <div v-if="showMobileSearch" class="mh-search-row">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M20 20l-4-4"></path>
          </svg>
          <input
            ref="mobileSearchInput"
            v-model="searchQuery"
            type="search"
            placeholder="Search devices or tags..."
            @blur="onMobileSearchBlur"
          >
        </div>
      </div>
    </header>

    <!-- Device limit exceeded banner -->
    <div v-if="isLicenseFull && !limitBannerDismissed" class="license-limit-banner">
      <span class="limit-banner-text">⚠️ Device limit reached ({{ licenseUsedCount }}/{{ deviceStore.licenseMaxDevices }}). New devices cannot connect.</span>
      <button class="limit-upgrade-btn" @click="showLicensePanel = true">Upgrade License</button>
      <button class="limit-close-btn" @click="limitBannerDismissed = true" title="Dismiss">✕</button>
    </div>

    <div class="content-layout">
      <section class="mobile-tag-bar">
        <button
          class="tag-filter"
          :class="{ active: tagStore.selectedTagIds.length === 0 && !deviceStore.showOfflineOnly }"
          @click="selectAllTags"
        >
          <span class="tag-dot all"></span>
          <span class="tag-name">All Devices</span>
          <span class="tag-count">{{ deviceStore.devices.length }}</span>
        </button>
        <button
          v-for="tag in tagStore.tags"
          :key="tag.id"
          class="tag-filter"
          :class="{ active: tagStore.selectedTagIds.includes(tag.id) }"
          :style="tagFilterStyle(tag)"
          @click="toggleSelectedTag(tag.id)"
        >
          <span class="tag-dot" :style="{ background: tag.color }"></span>
          <span class="tag-name">{{ tag.name }}</span>
          <span class="tag-count">{{ getTagDeviceCount(tag.id) }}</span>
        </button>
        <button
          class="tag-filter"
          :class="{ active: deviceStore.showOfflineOnly }"
          @click="toggleOfflineView"
        >
          <span class="tag-dot offline"></span>
          <span class="tag-name">Offline Devices</span>
          <span class="tag-count">{{ deviceStore.offlineDevices.length }}</span>
        </button>
      </section>

      <!-- Group Control Toolbar -->
      <section v-if="groupControlStore.isGroupControlActive" class="group-control-bar animate-fade-in" @click.stop>
        <div class="gc-bar-left">
          <span class="gc-brand-badge">⚡ Group Control</span>
          <button class="gc-btn" @click.stop="selectAllOnline" title="Select all online devices">
            Select All Online
          </button>
          <button class="gc-btn" @click.stop="clearSlaves" title="Clear all selected devices">
            Clear Selected
          </button>

          <!-- Select by tag dropdown -->
          <div class="gc-tag-dropdown-wrap" @click.stop>
            <button class="gc-btn gc-dropdown-btn" @click.stop="showTagDropdown = !showTagDropdown">
              <span>Select by Tag ▾</span>
            </button>
            <div v-if="showTagDropdown" class="gc-tag-dropdown-menu" @click.stop>
              <div 
                v-for="tag in tagStore.tags" 
                :key="tag.id" 
                class="gc-tag-item"
                @click="selectByTag(tag.id)"
              >
                <span class="gc-tag-dot" :style="{ backgroundColor: tag.color }"></span>
                <span class="gc-tag-name">{{ tag.name }}</span>
              </div>
              <div v-if="tagStore.tags.length === 0" class="gc-tag-empty">No tags available</div>
            </div>
          </div>

          <span class="gc-count-badge">Selected {{ groupControlStore.selectedSlaveIds.length }} devices</span>

          <!-- Interactive preview button -->
          <button 
            class="gc-btn gc-interactive-btn"
            :class="{ active: deviceStore.globalInteractiveMode }"
            @click.stop="toggleGlobalInteractive"
            title="When enabled, interact directly on preview without entering details"
          >
            <span class="gc-btn-icon">🎮</span>
            <span>Interactive Preview {{ deviceStore.globalInteractiveMode ? 'ON' : 'OFF' }}</span>
          </button>

          <button 
            v-if="groupControlStore.selectedSlaveIds.length > 0"
            class="gc-btn gc-tag-action-btn"
            @click="openTagManager('batch')"
            title="Batch assign tags to selected devices"
          >
            🏷 Batch Tag
          </button>
        </div>

        <div class="gc-bar-right">
          <button class="gc-exit-btn" @click="groupControlStore.toggleGroupControl(false)" title="Exit group control">
            Exit Group ✕
          </button>
        </div>
      </section>

      <main class="grid-container">
        <div v-if="deviceStore.loading && deviceStore.devices.length === 0" class="state-view">
          <div class="spinner"></div>
          <p>Fetching device list...</p>
        </div>

        <div v-else-if="deviceStore.devices.length === 0 && deviceStore.offlineDevices.length === 0" class="quickstart-container">
          <div class="quickstart-header">
            <div class="empty-icon">🔌</div>
            <h3 class="qs-title">Quickly Connect Your First Cloud Phone</h3>
            <p class="qs-subtitle">No online devices found. Use one of the following methods to register your Android device (physical phone, emulator, or Redroid container):</p>
          </div>

          <div class="quickstart-layout">
            <!-- Method 1: Web One-Click USB Auto-Deploy -->
            <div class="qs-card-box highlight">
              <div class="qs-badge">Recommended</div>
              <h4 class="qs-card-title">Method 1: Web One-Click USB Auto-Deploy</h4>
              <p class="qs-card-desc">Connect your physical phone via USB. Uses browser WebUSB/WebADB without installing any local environment to detect architecture, push, and launch the agent.</p>
              <p class="qs-card-desc-warn">⚠️ Note: This method connects directly via WebUSB and <b>does not support wireless or network ADB mode</b>.</p>
              <div class="qs-action-wrapper">
                <button class="qs-btn-primary" @click="goToDeploy">
                  <svg class="qs-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  Go to Web USB Deploy
                </button>
              </div>
            </div>

            <!-- Method 2: Manual / Command Line Deploy -->
            <div class="qs-card-box">
              <h4 class="qs-card-title">Method 2: Manual / Command Line Deploy</h4>
              <p class="qs-card-desc">Suitable for Linux/macOS physical devices, Redroid containers, remote VMs, or existing ADB clusters.</p>

              <!-- Prerequisites -->
              <div class="qs-prerequisites">
                <div class="qs-prereq-title">📋 Prerequisites:</div>
                <ul class="qs-prereq-list">
                  <li><b>Device Setup</b>: Go to "Settings -> Developer Options" and enable "USB Debugging". Connect physical phone via USB.</li>
                  <li><b>Host PC Setup</b>: Ensure ADB is installed and configured, and devices are recognized in your terminal.</li>
                </ul>
              </div>

              <!-- Dynamic configuration -->
              <div class="qs-form-grid">
                <div class="qs-form-item">
                  <label class="qs-form-label">Signaling Server IP:Port</label>
                  <input v-model="quickstartSignaling" class="qs-form-input" placeholder="e.g. 192.168.1.100:8443">
                </div>
                <div class="qs-form-item">
                  <label class="qs-form-label">Device ID (Optional)</label>
                  <input v-model="quickstartDeviceId" class="qs-form-input" placeholder="e.g. device_01">
                </div>
              </div>

              <!-- Core configuration -->
              <div class="qs-real-config">
                <div class="qs-config-row">
                  <span class="qs-config-label">Signaling (-signaling):</span>
                  <code class="qs-config-val">{{ signalingProtocol }}{{ quickstartSignaling }}/register_agent</code>
                  <button class="qs-config-copy" @click="copyText(`${signalingProtocol}${quickstartSignaling}/register_agent`)">Copy</button>
                </div>
                <div class="qs-config-row">
                  <span class="qs-config-label">Relay (-ice-servers):</span>
                  <code class="qs-config-val">{{ computedIceServers }}</code>
                  <button class="qs-config-copy" @click="copyText(computedIceServers)">Copy</button>
                </div>
              </div>

              <!-- Deploy mode tabs -->
              <div class="qs-mode-selector">
                <button 
                  class="qs-mode-btn" 
                  :class="{ active: quickstartMode === 'adb' }" 
                  @click="quickstartMode = 'adb'"
                >
                  💻 PC ADB One-Click Deploy (Non-Root)
                </button>
                <button 
                  class="qs-mode-btn magisk-qs-mode" 
                  :class="{ active: quickstartMode === 'magisk' }" 
                  @click="quickstartMode = 'magisk'"
                >
                  📱 Magisk / KSU Module (Root Auto-start)
                </button>
              </div>

              <!-- Mode A: PC ADB One-Click Deploy -->
              <template v-if="quickstartMode === 'adb'">
                <!-- Step 1: Download Deploy Package -->
                <div class="qs-step-block">
                  <div class="qs-step-title">Step 1: Download ADB Deploy Package (All architectures & runner scripts)</div>
                  <div class="qs-download-row">
                    <a href="/downloads/agent-deploy.zip" download="agent-deploy.zip" class="qs-download-link">
                      <svg class="qs-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Download Unified Deploy Package (agent-deploy.zip)
                    </a>
                  </div>
                </div>

                <!-- Step 2: Run Command -->
                <div class="qs-step-block">
                  <div class="qs-step-title">Step 2: Unzip and run command in terminal with device connected</div>
                  
                  <!-- OS Switch -->
                  <div class="qs-tabs">
                    <button class="qs-tab" :class="{ active: qsActiveOs === 'unix' }" @click="qsActiveOs = 'unix'">Linux / macOS (One-Click)</button>
                    <button class="qs-tab" :class="{ active: qsActiveOs === 'win' }" @click="qsActiveOs = 'win'">Windows CMD (One-Click)</button>
                  </div>

                  <!-- Terminal Viewport -->
                  <div class="qs-terminal">
                    <pre v-if="qsActiveOs === 'unix'" class="qs-code-text"># Unzip and run one-click command in terminal (detects architecture, pushes and starts service)
chmod +x run.sh
./run.sh -id "{{ quickstartDeviceId || 'device_01' }}" -signaling "{{ signalingProtocol }}{{ quickstartSignaling }}" -ice-servers "{{ computedIceServers }}"</pre>
                    <pre v-else-if="qsActiveOs === 'win'" class="qs-code-text">:: Unzip and run one-click command in CMD window (detects architecture, pushes and starts service)
run.bat -id "{{ quickstartDeviceId || 'device_01' }}" -signaling "{{ signalingProtocol }}{{ quickstartSignaling }}" -ice-servers "{{ computedIceServers }}"</pre>
                    <button class="qs-copy-btn" @click="copyCommandText">Copy Command</button>
                  </div>
                </div>
              </template>

              <!-- Mode B: Magisk / KSU Module Deploy -->
              <template v-else-if="quickstartMode === 'magisk'">
                <!-- Step 1: Download Module Package -->
                <div class="qs-step-block">
                  <div class="qs-step-title">Step 1: Download Magisk Module Package (Rooted Physical Device)</div>
                  <div class="qs-download-row">
                    <a href="/agent/cloudphone-agent-magisk.pkg" download="cloudphone-agent-magisk.zip" class="qs-download-link magisk-qs-btn">
                      <svg class="qs-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                      </svg>
                      Download Magisk Module (cloudphone-agent-magisk.zip)
                    </a>
                  </div>
                </div>

                <!-- Step 2: Flash and Restart -->
                <div class="qs-step-block">
                  <div class="qs-step-title">Step 2: Flash module on phone, reboot, and configure signaling server</div>
                  
                  <!-- Terminal Viewport -->
                  <div class="qs-terminal">
                    <pre class="qs-code-text"># After flashing module and rebooting, execute in phone terminal or adb shell:
su
cpctl set CP_AGENT_SIGNALING "{{ signalingProtocol }}{{ quickstartSignaling }}"
cpctl set CP_AGENT_ICE_SERVERS "{{ computedIceServers }}"<template v-if="quickstartDeviceId">
cpctl set CP_AGENT_ID "{{ quickstartDeviceId }}"</template>
cpctl restart</pre>
                    <button class="qs-copy-btn" @click="copyCommandText">Copy Command</button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div v-else-if="noVisibleDevices" class="state-view">
          <div class="empty-icon">🔎</div>
          <h3>No Matching Results</h3>
          <p>Adjust search keywords or tag filters</p>
        </div>

        <div v-else>
          <!-- High-density data table view -->
          <template v-if="isTableView">
            <div class="device-table-container">
              <div class="device-table-header">
                <div class="th col-select">
                  <span v-if="groupControlStore.isGroupControlActive">
                    <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" title="Select / Deselect All" class="header-checkbox" />
                  </span>
                </div>
                <div class="th col-thumb">Preview</div>
                <div class="th col-device sortable" @click="handleTableSort('id')" title="Click to sort">
                  Device ID <span class="sort-icon">{{ getSortIcon('id') }}</span>
                </div>
                <div class="th col-status sortable" @click="handleTableSort('status')" title="Click to sort">
                  Status <span class="sort-icon">{{ getSortIcon('status') }}</span>
                </div>
                <div class="th col-clients">Connections</div>
                <div class="th col-metrics sortable" @click="handleTableSort('cpu')" title="Click to sort by CPU">
                  System Load <span class="sort-icon">{{ getSortIcon('cpu') }}</span>
                </div>
                <div class="th col-tags">Tags</div>
                <div class="th col-actions">Actions</div>
              </div>

              <div class="device-table-body">
                <template v-if="deviceStore.showOfflineOnly">
                  <DeviceListItem
                    v-for="device in sortedOfflineDevices"
                    :key="device.id"
                    :device="device"
                    :tags="tagStore.getTagsForDevice(device.id)"
                    @connect="connectDevice"
                    @settings="openSettings"
                    @edit-tags="id => openTagManager('single', id)"
                    @share="openShareModal"
                  />
                </template>
                <template v-else>
                  <DeviceListItem
                    v-for="device in sortedDevices"
                    :key="device.id"
                    :device="device"
                    :tags="tagStore.getTagsForDevice(device.id)"
                    @connect="connectDevice"
                    @settings="openSettings"
                    @edit-tags="id => openTagManager('single', id)"
                    @share="openShareModal"
                  />

                  <!-- Offline devices section -->
                  <template v-if="sortedOfflineDevices.length > 0">
                    <div class="table-offline-divider">
                      <span>Offline Devices ({{ sortedOfflineDevices.length }})</span>
                    </div>
                    <DeviceListItem
                      v-for="device in sortedOfflineDevices"
                      :key="device.id"
                      :device="device"
                      :tags="tagStore.getTagsForDevice(device.id)"
                      @connect="connectDevice"
                      @settings="openSettings"
                      @edit-tags="id => openTagManager('single', id)"
                      @share="openShareModal"
                    />
                  </template>
                </template>
              </div>
            </div>
          </template>

          <!-- Card grid view -->
          <template v-else>
            <!-- Offline filter view: Offline devices only -->
            <div
              v-if="deviceStore.showOfflineOnly"
              class="device-grid offline-grid"
              :style="{ gridTemplateColumns: gridColumnsStyle }"
            >
              <DeviceCard
                v-for="device in filteredOfflineDevices"
                :key="device.id"
                :device="device"
                :tags="tagStore.getTagsForDevice(device.id)"
                @connect="connectDevice"
                @settings="openSettings"
                @edit-tags="id => openTagManager('single', id)"
              />
            </div>
            <template v-else>
              <div 
                v-if="filteredDevices.length > 0"
                class="device-grid" 
                :style="{ gridTemplateColumns: gridColumnsStyle }"
              >
                <DeviceCard
                  v-for="device in filteredDevices"
                  :key="device.id"
                  :device="device"
                  :tags="tagStore.getTagsForDevice(device.id)"
                  @connect="connectDevice"
                  @settings="openSettings"
                  @edit-tags="id => openTagManager('single', id)"
                  @share="openShareModal"
                />
              </div>

              <!-- Offline devices section -->
              <div v-if="filteredOfflineDevices.length > 0" class="offline-section">
                <div class="offline-section-header">
                  <span class="offline-section-title">Offline Devices</span>
                  <span class="offline-section-count">{{ filteredOfflineDevices.length }}</span>
                </div>
                <div 
                  class="device-grid offline-grid" 
                  :style="{ gridTemplateColumns: gridColumnsStyle }"
                >
                  <DeviceCard
                    v-for="device in filteredOfflineDevices"
                    :key="device.id"
                    :device="device"
                    :tags="tagStore.getTagsForDevice(device.id)"
                    @connect="connectDevice"
                    @settings="openSettings"
                    @edit-tags="id => openTagManager('single', id)"
                    @share="openShareModal"
                  />
                </div>
              </div>
            </template>
          </template>
        </div>
      </main>
    </div>

    <SettingsModal 
      v-if="showSettingsModal" 
      :settings="localSettings" 
      :is-connected="false"
      :is-global="!selectedDeviceId"
      :is-custom="!!selectedDeviceId && hasCustomSettings(selectedDeviceId)"
      :locked-sections="policyLocked"
      :show-preview-tab="authStore.isAdmin"
      @close="closeSettings" 
      @save="saveSettings" 
      @reset="resetSettings"
    />

    <TagManagerModal
      v-if="showTagManager"
      :devices="tagManagerDevices"
      :mode="tagManagerMode"
      @close="closeTagManager"
    />

    <!-- Global ShareModal -->
    <ShareModal
      :visible="shareModalVisible"
      :deviceId="shareTargetDeviceId"
      @close="shareModalVisible = false"
    />

    <!-- License management panel -->
    <LicensePanel :visible="showLicensePanel" @close="showLicensePanel = false" />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDeviceStore } from '@/stores/devices'
import { useTagStore } from '@/stores/tags'
import DeviceCard from '@/components/DeviceCard.vue'
import DeviceListItem from '@/components/DeviceListItem.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import TagManagerModal from '@/components/TagManagerModal.vue'
import ShareModal from '@/components/ShareModal.vue'
import LicensePanel from '@/components/LicensePanel.vue'

import { getDeviceSettings, saveDeviceSettings, hasCustomSettings, deleteDeviceSettings, applyPolicyToSettings, policyLockedSections } from '@/utils/settings'
import { useAuthStore } from '@/stores/auth'
import { useGroupControlStore } from '@/stores/groupControl'

const router = useRouter()
const deviceStore = useDeviceStore()
const tagStore = useTagStore()
const groupControlStore = useGroupControlStore()

const shareModalVisible = ref(false)
const shareTargetDeviceId = ref('')

const authStore = useAuthStore()

// License management panel and usage badge
const showLicensePanel = ref(false)
// Dismiss flag for limit warning banner in current session
const limitBannerDismissed = ref(false)

// License usage: online devices count
const licenseUsedCount = computed(() => deviceStore.onlineDevices.length)
const licenseUsagePercent = computed(() => {
  const max = deviceStore.licenseMaxDevices || 1
  return Math.round((licenseUsedCount.value / max) * 100)
})
const isLicenseFull = computed(() => {
  if (deviceStore.licenseMaxDevices >= 99999 || authStore.role === 'admin') return false
  return licenseUsedCount.value >= deviceStore.licenseMaxDevices
})

const licenseBadgeText = computed(() => {
  const used = licenseUsedCount.value
  const max = deviceStore.licenseMaxDevices
  if (deviceStore.licenseActivated) {
    if (max >= 99999 || authStore.role === 'admin') {
      return `Enterprise · Unlimited (${used} active)`
    }
    return `Licensed ${used}/${max} · ${deviceStore.licenseDaysRemaining}d remaining`
  }
  if (deviceStore.licensePromo) {
    return `Promo ${used}/${max} units`
  }
  return `Community ${used}/${max} units`
})

const licenseBadgeTitle = computed(() => {
  if (deviceStore.licenseActivated) {
    if (deviceStore.licenseMaxDevices >= 99999 || authStore.role === 'admin') {
      return 'Enterprise Full Source Edition · Unlimited devices & permanent validity'
    }
    return `License expiration: ${deviceStore.licenseExpiresAt || '-'}, click for license management`
  }
  if (deviceStore.licensePromo) {
    return `Promo until ${deviceStore.licenseExpiresAt}, then reverts to ${deviceStore.licensePostPromoMaxDevices} units`
  }
  return 'Community edition license, click for license management'
})

const licenseBadgeClass = computed(() => {
  if (deviceStore.licenseActivated && (deviceStore.licenseMaxDevices >= 99999 || authStore.role === 'admin')) return 'badge-enterprise'
  if (deviceStore.licenseStatus === 'expired' || deviceStore.isLicenseExpired) return 'badge-danger'
  if (licenseUsagePercent.value >= 100) return 'badge-danger'
  if (licenseUsagePercent.value >= 80) return 'badge-warn'
  if (deviceStore.licenseActivated && deviceStore.licenseDaysRemaining <= 30) return 'badge-warn'
  return ''
})

function openShareModal(deviceId) {
  shareTargetDeviceId.value = deviceId
  shareModalVisible.value = true
}
const cardSize = computed(() => deviceStore.cardSize)
const searchQuery = computed({
  get: () => deviceStore.searchQuery,
  set: (v) => { deviceStore.searchQuery = v }
})
const showTagDropdown = ref(false)
const viewMode = computed(() => deviceStore.viewMode)

function toggleViewMode() {
  deviceStore.toggleViewMode()
}

function openMultiDirectControl() {
  if (deviceStore.activeDeviceIds.length === 0) {
    const online = deviceStore.onlineDevices.slice(0, 2)
    if (online.length > 0) {
      online.forEach(d => deviceStore.openDevice(d.id))
    }
  }
}

// Mobile detection
const isMobile = ref(window.innerWidth <= 1024)
const updateMobileMedia = () => {
  isMobile.value = window.innerWidth <= 1024
}

// Mobile grid cols: 2/3/4, default 4, persisted to localStorage
const savedMobileCols = parseInt(localStorage.getItem('cloudphone_mobile_cols'), 10)
const mobileCols = ref([2, 3, 4].includes(savedMobileCols) ? savedMobileCols : 4)
watch(mobileCols, (newVal) => {
  localStorage.setItem('cloudphone_mobile_cols', newVal.toString())
})

// Sort mode: default=lexicographical, recent=lastSeen priority
const savedSortBy = localStorage.getItem('cloudphone_sort_by')
const sortBy = ref(savedSortBy === 'recent' ? 'recent' : 'default')
watch(sortBy, (newVal) => {
  localStorage.setItem('cloudphone_sort_by', newVal)
})

// Grid layout: mobile fixed cols, desktop responsive
const gridColumnsStyle = computed(() => {
  if (isMobile.value) {
    return `repeat(${mobileCols.value}, minmax(0, 1fr))`
  }
  return `repeat(auto-fill, minmax(${cardSize.value}px, 1fr))`
})

// Mobile header dropdown & search state
const mobileOpenMenu = ref('') // '' | 'batch' | 'tag' | 'sort' | 'cols'
const showMobileSearch = ref(false)
const mobileSearchInput = ref(null)

function toggleMobileMenu(name) {
  mobileOpenMenu.value = mobileOpenMenu.value === name ? '' : name
}

function closeMobileMenus() {
  mobileOpenMenu.value = ''
}

function toggleMobileSearch() {
  showMobileSearch.value = !showMobileSearch.value
  if (showMobileSearch.value) {
    nextTick(() => mobileSearchInput.value?.focus())
  }
}

// Collapse on blur
function onMobileSearchBlur() {
  if (!searchQuery.value.trim()) {
    showMobileSearch.value = false
  }
}

function refreshDevices() {
  deviceStore.fetchDevices()
}

// Enter / exit group control
function toggleMobileGroupControl() {
  groupControlStore.toggleGroupControl()
}

function setSortBy(val) {
  sortBy.value = val
  closeMobileMenus()
}

function setMobileCols(n) {
  mobileCols.value = n
  closeMobileMenus()
}

// lastSeen timestamp helper
function lastSeenTime(device) {
  const t = device.lastSeen ? new Date(device.lastSeen).getTime() : 0
  return Number.isNaN(t) ? 0 : t
}

function selectAllOnline() {
  groupControlStore.selectAllOnline(deviceStore.devices)
}

function clearSlaves() {
  groupControlStore.clearSlaves()
}

function selectByTag(tagId) {
  groupControlStore.selectByTag(tagId, deviceStore.devices, tagStore)
  showTagDropdown.value = false
}

function toggleGlobalInteractive() {
  if (!deviceStore.globalInteractiveMode) {
    deviceStore.globalPreviewMode = true
    deviceStore.globalInteractiveMode = true
  } else {
    deviceStore.globalInteractiveMode = false
  }
}

// Close dropdowns on blank click
function closeTagDropdownMenu() {
  showTagDropdown.value = false
  closeMobileMenus()
}

onMounted(() => {
  window.addEventListener('click', closeTagDropdownMenu)
  window.addEventListener('resize', updateMobileMedia)
})

onUnmounted(() => {
  window.removeEventListener('click', closeTagDropdownMenu)
  window.removeEventListener('resize', updateMobileMedia)
  clearInterval(accountExpiryTimer)
})

watch(() => deviceStore.globalPreviewMode, (newVal) => {
  if (!newVal) {
    deviceStore.globalInteractiveMode = false
  }
})

watch(cardSize, (newVal) => {
  localStorage.setItem('cloudphone_card_size', newVal.toString())
})

let refreshInterval = null
const showSettingsModal = ref(false)
const selectedDeviceId = ref('')
const showTagManager = ref(false)
const tagManagerDevices = ref([])
const tagManagerMode = ref('full')

// User-level setting restrictions
const policyLocked = computed(() => policyLockedSections(authStore.userPolicy))

// Mobile header: Account remaining time
const accountNowTick = ref(Date.now())
let accountExpiryTimer = setInterval(() => { accountNowTick.value = Date.now() }, 1000)

const accountExpiryTime = computed(() => {
  const p = authStore.userPolicy
  if (!p || !p.expires_at) return null
  const t = new Date(p.expires_at)
  if (Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return null
  return t
})
const accountExpired = computed(() => !!accountExpiryTime.value && accountExpiryTime.value.getTime() <= accountNowTick.value)
const accountExpiryChip = computed(() => {
  const t = accountExpiryTime.value
  if (!t) return ''
  const ms = t.getTime() - accountNowTick.value
  if (ms <= 0) return 'Expired'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000).toString().padStart(2, '0')
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0')
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
  return d > 0 ? `${d}d left` : `${h}:${m}:${s} left`
})

const localSettings = ref(applyPolicyToSettings(getDeviceSettings(''), authStore.userPolicy))
if (!authStore.userPolicy && authStore.token) {
  authStore.fetchMe().then(() => {
    localSettings.value = applyPolicyToSettings(localSettings.value, authStore.userPolicy)
  })
}

const filteredDevices = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  const result = deviceStore.devices.filter(device => {
    const deviceTags = tagStore.getTagsForDevice(device.id)
    const matchesTag = tagStore.selectedTagIds.length === 0 || 
      tagStore.selectedTagIds.every(id => deviceTags.some(tag => tag.id === id))
    if (!matchesTag) return false

    if (!query) return true

    const searchable = [
      device.id,
      device.info?.model,
      ...deviceTags.map(tag => tag.name)
    ].filter(Boolean).join(' ').toLowerCase()

    return searchable.includes(query)
  })

  // Sort: recent by lastSeen, default keeps original order
  if (sortBy.value === 'recent') {
    return [...result].sort((a, b) => lastSeenTime(b) - lastSeenTime(a))
  }
  return result
})

// Offline devices filter
const filteredOfflineDevices = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return deviceStore.offlineDevices.filter(device => {
    const deviceTags = tagStore.getTagsForDevice(device.id)
    const matchesTag = tagStore.selectedTagIds.length === 0 ||
      tagStore.selectedTagIds.every(id => deviceTags.some(tag => tag.id === id))
    if (!matchesTag) return false

    if (!query) return true

    const searchable = [
      device.id,
      device.info?.model,
      ...deviceTags.map(tag => tag.name)
    ].filter(Boolean).join(' ').toLowerCase()

    return searchable.includes(query)
  })
})

// View mode helper
const isTableView = computed(() => ['table', 'list'].includes(deviceStore.viewMode))

const tableSortField = ref('id') // 'id' | 'status' | 'cpu' | 'lastSeen'
const tableSortAsc = ref(true)

function handleTableSort(field) {
  if (tableSortField.value === field) {
    tableSortAsc.value = !tableSortAsc.value
  } else {
    tableSortField.value = field
    tableSortAsc.value = field === 'id'
  }
}

function getSortIcon(field) {
  if (tableSortField.value !== field) return '↕'
  return tableSortAsc.value ? '▲' : '▼'
}

const isAllSelected = computed(() => {
  const online = filteredDevices.value.filter(d => d.status === 'online')
  return online.length > 0 && online.every(d => groupControlStore.selectedSlaveIds.includes(d.id))
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    groupControlStore.clearSlaves()
  } else {
    groupControlStore.selectAllOnline(filteredDevices.value)
  }
}

const sortedDevices = computed(() => {
  const list = [...filteredDevices.value]
  return list.sort((a, b) => {
    let res = 0
    if (tableSortField.value === 'id') {
      res = a.id.localeCompare(b.id)
    } else if (tableSortField.value === 'status') {
      const aVal = a.status === 'online' ? 1 : 0
      const bVal = b.status === 'online' ? 1 : 0
      res = bVal - aVal
    } else if (tableSortField.value === 'cpu') {
      const aVal = a.metrics?.cpu || 0
      const bVal = b.metrics?.cpu || 0
      res = aVal - bVal
    } else if (tableSortField.value === 'lastSeen') {
      res = lastSeenTime(a) - lastSeenTime(b)
    }
    return tableSortAsc.value ? res : -res
  })
})

const sortedOfflineDevices = computed(() => {
  const list = [...filteredOfflineDevices.value]
  return list.sort((a, b) => {
    let res = 0
    if (tableSortField.value === 'id') {
      res = a.id.localeCompare(b.id)
    } else {
      res = lastSeenTime(a) - lastSeenTime(b)
    }
    return tableSortAsc.value ? res : -res
  })
})

// Check if empty view
const noVisibleDevices = computed(() => {
  if (deviceStore.showOfflineOnly) {
    return filteredOfflineDevices.value.length === 0
  }
  return filteredDevices.value.length === 0 && filteredOfflineDevices.value.length === 0
})

function selectAllTags() {
  tagStore.clearSelectedTags()
  deviceStore.showOfflineOnly = false
}

function toggleOfflineView() {
  deviceStore.showOfflineOnly = !deviceStore.showOfflineOnly
  if (deviceStore.showOfflineOnly) {
    // Offline and tag filters mutually exclusive
    tagStore.clearSelectedTags()
  }
}

// Auto exit offline view when empty
watch(() => deviceStore.offlineDevices.length, len => {
  if (len === 0 && deviceStore.showOfflineOnly) {
    deviceStore.showOfflineOnly = false
  }
})

function openGlobalSettings() {
  selectedDeviceId.value = ''
  localSettings.value = applyPolicyToSettings(getDeviceSettings(''), authStore.userPolicy)
  showSettingsModal.value = true
}

function goToDeploy() {
  window.dispatchEvent(new CustomEvent('cloudphone-navigate', { detail: '/deploy' }))
}

function openSettings(deviceId) {
  selectedDeviceId.value = deviceId
  localSettings.value = applyPolicyToSettings(getDeviceSettings(deviceId), authStore.userPolicy)
  showSettingsModal.value = true
}

function closeSettings() {
  showSettingsModal.value = false
  selectedDeviceId.value = ''
}

function saveSettings(newSettings) {
  localSettings.value = newSettings
  saveDeviceSettings(selectedDeviceId.value, newSettings)
  
  if (selectedDeviceId.value) {
    connectDevice(selectedDeviceId.value)
  }
  closeSettings()
}

function resetSettings() {
  if (selectedDeviceId.value) {
    deleteDeviceSettings(selectedDeviceId.value)
    closeSettings()
  }
}

function openTagManager(type, deviceId = '') {
  if (type === 'full') {
    tagManagerMode.value = 'full'
    tagManagerDevices.value = deviceStore.devices
  } else if (type === 'single' && deviceId) {
    tagManagerMode.value = 'assign'
    tagManagerDevices.value = deviceStore.devices.filter(d => d.id === deviceId)
  } else if (type === 'batch') {
    tagManagerMode.value = 'assign'
    const selectedIds = groupControlStore.selectedSlaveIds
    tagManagerDevices.value = deviceStore.devices.filter(d => selectedIds.includes(d.id))
  }
  showTagManager.value = true
}

function closeTagManager() {
  showTagManager.value = false
  tagManagerDevices.value = []
  tagManagerMode.value = 'full'
}

function tagFilterStyle(tag) {
  const active = tagStore.selectedTagIds.includes(tag.id)
  return {
    color: active ? '#fff' : 'var(--text-primary)',
    borderColor: `${tag.color}80`,
    background: active ? `${tag.color}35` : 'transparent'
  }
}

function getTagDeviceCount(tagId) {
  return deviceStore.devices.filter(device => tagStore.getTagIdsForDevice(device.id).includes(tagId)).length
}

const quickstartSignaling = ref('')
const quickstartDeviceId = ref('device_01')
const quickstartMode = ref('adb') // 'adb' | 'magisk'
const qsActiveOs = ref('unix')

const signalingProtocol = computed(() => {
  return window.location.protocol === 'https:' ? 'wss://' : 'ws://'
})

const fetchedIceServers = ref('')

const computedIceServers = computed(() => {
  if (fetchedIceServers.value) {
    return fetchedIceServers.value
  }
  const host = quickstartSignaling.value || window.location.host
  const ip = host.split(':')[0] || '127.0.0.1'
  return `turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478`
})

// Format ICE servers array to comma-separated string
function formatIceServers(servers) {
  if (!Array.isArray(servers)) return ''
  const result = []
  servers.forEach(srv => {
    if (!srv.urls || !Array.isArray(srv.urls)) return
    srv.urls.forEach(url => {
      if ((url.startsWith('turn:') || url.startsWith('turns:')) && srv.username) {
        const prefix = url.startsWith('turn:') ? 'turn:' : 'turns:'
        const hostPart = url.substring(prefix.length)
        result.push(`${prefix}${srv.username}:${srv.credential || ''}@${hostPart}`)
      } else {
        result.push(url)
      }
    })
  })
  return result.join(',')
}

// Fetch configured ICE servers list from backend
async function fetchIceServers() {
  try {
    const res = await fetch('/api/ice_servers')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const formatted = formatIceServers(data)
        if (formatted) {
          fetchedIceServers.value = formatted
        }
      }
    }
  } catch (err) {
    console.error('Failed to get ICE Servers:', err)
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard successfully!')
  }).catch(err => {
    console.error('Copy failed:', err)
    alert('Copy failed, please copy manually.')
  })
}

function copyCommandText() {
  let cmd = ''
  if (quickstartMode.value === 'adb') {
    if (qsActiveOs.value === 'unix') {
      cmd = `./run.sh -id "${quickstartDeviceId.value || 'device_01'}" -signaling "${signalingProtocol.value}${quickstartSignaling.value}" -ice-servers "${computedIceServers.value}"`
    } else if (qsActiveOs.value === 'win') {
      cmd = `run.bat -id "${quickstartDeviceId.value || 'device_01'}" -signaling "${signalingProtocol.value}${quickstartSignaling.value}" -ice-servers "${computedIceServers.value}"`
    }
  } else if (quickstartMode.value === 'magisk') {
    const iceCmd = computedIceServers.value ? `\ncpctl set CP_AGENT_ICE_SERVERS "${computedIceServers.value}"` : ''
    const devIdCmd = quickstartDeviceId.value ? `\ncpctl set CP_AGENT_ID "${quickstartDeviceId.value}"` : ''
    cmd = `su\ncpctl set CP_AGENT_SIGNALING "${signalingProtocol.value}${quickstartSignaling.value}"${iceCmd}${devIdCmd}\ncpctl restart`
  }
  copyText(cmd)
}

function toggleSelectedTag(tagId) {
  tagStore.toggleSelectedTag(tagId)
  // Exit offline view when selecting a tag
  deviceStore.showOfflineOnly = false
}

function handleOpenGlobalSettingsEvent() {
  openGlobalSettings()
}

function handleOpenTagManagerEvent(e) {
  openTagManager(e?.detail?.mode || 'full')
}

onMounted(async () => {
  quickstartSignaling.value = window.location.host
  deviceStore.fetchDevices()
  refreshInterval = setInterval(() => {
    deviceStore.fetchDevices()
  }, 10000)
  window.addEventListener('cloudphone-open-tag-manager', handleOpenTagManagerEvent)
  window.addEventListener('open-tag-manager', handleOpenTagManagerEvent)
  window.addEventListener('open-global-settings', handleOpenGlobalSettingsEvent)
  await fetchIceServers()
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  window.removeEventListener('cloudphone-open-tag-manager', handleOpenTagManagerEvent)
  window.removeEventListener('open-tag-manager', handleOpenTagManagerEvent)
  window.removeEventListener('open-global-settings', handleOpenGlobalSettingsEvent)
})

function connectDevice(deviceId) {
  // Default connect mode to display
  if (!deviceStore.getDeviceMode(deviceId)) {
    deviceStore.setDeviceMode(deviceId, 'display')
  }
  deviceStore.setActiveDevice(deviceId)
}
</script>

<style scoped>
.device-list-page {
  padding: 16px 20px;
  min-height: 100%;
}

/* Limit warning banner */
.license-limit-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(248, 81, 73, 0.08);
  border: 1px solid rgba(248, 81, 73, 0.4);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #f85149;
}

.limit-banner-text {
  flex: 1;
  font-weight: 500;
}

.limit-upgrade-btn {
  background: #238636;
  border: 1px solid #2ea44f;
  border-radius: 6px;
  color: #ffffff;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.limit-upgrade-btn:hover {
  background: #2ea44f;
}

.limit-close-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 14px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.limit-close-btn:hover {
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.08);
}

.deploy-btn.secondary {
  background: rgba(255, 255, 255, 0.035);
  color: #d0d7de;
}

.deploy-btn.primary {
  color: #fff;
  background: rgba(88, 166, 255, 0.18);
  border-color: rgba(88, 166, 255, 0.35);
}

.mobile-tag-action {
  display: none;
}

.deploy-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}

.deploy-btn.primary:hover {
  background: rgba(88, 166, 255, 0.26);
  border-color: rgba(88, 166, 255, 0.5);
}

.size-control {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.preview-switches {
  display: contents;
}

.preview-mode-switch {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.switch-label.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.switch-label.disabled .switch-checkbox {
  cursor: not-allowed;
}

.switch-checkbox {
  cursor: pointer;
  accent-color: var(--accent);
}

.switch-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.size-control .label {
  font-size: 13px;
  color: var(--text-secondary);
}

.size-slider {
  width: 96px;
  height: 4px;
  -webkit-appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

.size-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.size-value {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content-layout {
  display: block;
}

.mobile-tag-bar {
  display: none;
}

.tag-filter {
  width: 100%;
  min-width: 0;
  height: 34px;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-primary);
  background: transparent;
  text-align: left;
  font-size: 12px;
}

.tag-filter:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tag-filter.active {
  border-color: var(--accent);
  background: rgba(233, 69, 96, 0.16);
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tag-dot.all {
  background: var(--accent);
}

.tag-dot.offline {
  background: #8b949e;
}

.tag-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tag-count {
  min-width: 22px;
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.08);
  font-size: 11px;
  text-align: center;
}

.btn-refresh-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-refresh-icon:hover {
  background: rgba(255, 255, 255, 0.05);
}

.grid-container {
  min-width: 0;
  width: 100%;
}

/* Group control toolbar */
.group-control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(90deg, rgba(255, 159, 67, 0.12) 0%, rgba(26, 115, 232, 0.08) 100%);
  border: 1px solid rgba(255, 159, 67, 0.35);
  border-radius: 8px;
  padding: 8px 14px;
  margin-bottom: 12px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  position: relative;
  z-index: 50;
}

.gc-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.gc-brand-badge {
  font-size: 12px;
  font-weight: 700;
  color: #ff9f43;
  display: flex;
  align-items: center;
  gap: 4px;
}

.gc-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #f1f5f9);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.gc-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
}

.gc-btn.gc-interactive-btn.active {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.5);
  color: #38bdf8;
  font-weight: 600;
}

.gc-tag-dropdown-wrap {
  position: relative;
  z-index: 60;
}

.gc-tag-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
  z-index: 1000;
  min-width: 150px;
  padding: 6px 0;
  max-height: 240px;
  overflow-y: auto;
}

.gc-tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: 12px;
  color: #f1f5f9;
}

.gc-tag-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.gc-tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.gc-tag-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gc-tag-empty {
  padding: 8px 12px;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}

.gc-count-badge {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.25);
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.gc-tag-action-btn {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.4);
  color: #38bdf8;
}

.gc-exit-btn {
  background: rgba(248, 81, 73, 0.12);
  border: 1px solid rgba(248, 81, 73, 0.3);
  color: #f85149;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.gc-exit-btn:hover {
  background: rgba(248, 81, 73, 0.25);
  border-color: rgba(248, 81, 73, 0.5);
}

.device-grid {
  display: grid;
  gap: 16px;
  grid-auto-flow: dense;
}

/* High-density table */
.device-table-container {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  width: 100%;
}

.device-table-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(13, 17, 23, 0.85);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary, #94a3b8);
  letter-spacing: 0.04em;
  user-select: none;
}

.th {
  display: flex;
  align-items: center;
  padding: 0 6px;
  box-sizing: border-box;
  overflow: hidden;
}

.th.sortable {
  cursor: pointer;
  transition: color 0.15s;
}

.th.sortable:hover {
  color: #f1f5f9;
}

.sort-icon {
  font-size: 9px;
  margin-left: 4px;
  opacity: 0.7;
}

.header-checkbox {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--accent, #388bfd);
}

.table-offline-divider {
  padding: 8px 16px;
  background: rgba(15, 23, 42, 0.6);
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary, #94a3b8);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* List view backward compatibility */
.device-list-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.offline-section {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px dashed var(--border);
}

.offline-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.offline-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
}

.offline-section-count {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-secondary, #94a3b8);
}

.offline-grid :deep(.device-card) {
  filter: grayscale(0.55);
  opacity: 0.72;
  transition: filter 0.2s ease, opacity 0.2s ease;
}

.offline-grid :deep(.device-card:hover) {
  filter: grayscale(0.2);
  opacity: 0.95;
}

.state-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  color: var(--text-secondary);
  text-align: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.state-view h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

/* Mobile styles */
@media (max-width: 1024px) {
  .device-list-page {
    padding: 8px 10px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .page-header {
    margin-bottom: 8px;
    padding-bottom: 8px;
  }

  /* Mobile compact header */
  .mobile-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mh-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Right-aligned dropdown panels */
  .mh-dropdown.drop-right .mh-panel {
    left: auto;
    right: 0;
  }

  /* Account remaining time capsule */
  .mh-expiry-chip {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 600;
    color: #d29922;
    border: 1px solid rgba(210, 153, 34, 0.4);
    border-radius: 999px;
    padding: 3px 7px;
    white-space: nowrap;
  }

  .mh-expiry-chip.expired {
    color: #f85149;
    border-color: rgba(248, 81, 73, 0.5);
  }

  .mh-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  /* Row 1 right icon buttons */
  .mh-icon-btn {
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.035);
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
  }

  .mh-icon-btn svg {
    width: 15px;
    height: 15px;
  }

  .mh-icon-btn.active,
  .mh-icon-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Inline compact dropdown triggers */
  .mh-dropdown {
    position: relative;
  }

  .mh-filter-btn {
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.035);
    color: var(--text-primary);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }

  .mh-filter-btn.active {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Dropdown panel constraints */
  .mh-panel {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 6px;
    min-width: 140px;
    max-width: min(72vw, 240px);
    max-height: 60vh;
    overflow-y: auto;
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 200;
    padding: 6px;
  }

  .mh-panel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }

  .mh-panel-item:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .mh-panel-item.active {
    color: var(--accent);
    background: rgba(88, 166, 255, 0.12);
  }

  .mh-item-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mh-item-count {
    margin-left: auto;
    min-width: 20px;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
    font-size: 11px;
    text-align: center;
    flex: 0 0 auto;
  }

  .mh-panel-static {
    padding: 4px 10px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .mh-panel-divider {
    height: 1px;
    margin: 4px 6px;
    background: var(--border);
  }

  /* Preview toggles in batch panel */
  .mh-switch {
    padding: 8px 10px;
  }

  /* Search expanded input */
  .mh-search-row .search-box {
    width: 100%;
    height: 34px;
  }

  .content-layout {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Mobile vertical scroll */
  .grid-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Mobile cols spacing */
  .device-grid {
    gap: 8px;
    padding: 2px 2px 12px;
  }

  .device-grid > * {
    min-width: 0;
    height: auto;
    aspect-ratio: 3 / 4;
  }

  .device-list-view {
    gap: 8px;
    padding-bottom: 12px;
  }
}

/* Group control switch styles */
/* Group control quick action panel */
.group-quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 4px 10px;
  margin-right: 12px;
}

.action-btn-mini {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn-mini:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}

.action-btn-mini.dropdown-trigger {
  position: relative;
}

/* Tag dropdown menu */
.tag-select-dropdown {
  position: relative;
}

.tag-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 100;
  min-width: 130px;
  padding: 6px 0;
  max-height: 200px;
  overflow-y: auto;
}

.tag-dropdown-menu::-webkit-scrollbar {
  width: 4px;
}

.tag-dropdown-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.tag-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s ease;
  font-size: 12px;
  color: var(--text-primary);
}

.tag-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tag-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-dropdown-empty {
  padding: 8px 12px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.selected-count-badge {
  font-size: 11px;
  color: var(--accent);
  background: rgba(26, 115, 232, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.group-mode-badge {
  font-size: 11px;
  color: #ff9f43;
  background: rgba(255, 159, 67, 0.12);
  border: 1px solid rgba(255, 159, 67, 0.25);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Simple fade animation */
.animate-fade-in {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Quickstart onboarding styles */
.quickstart-container {
  max-width: 1200px;
  margin: 30px auto;
  padding: 0 24px;
  color: var(--text-primary);
}

.quickstart-header {
  text-align: center;
  margin-bottom: 32px;
}

.quickstart-header .empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.qs-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 12px 0;
  background: linear-gradient(135deg, #58a6ff 0%, #bc8cff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.qs-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 680px;
  margin: 0 auto;
  opacity: 0.85;
}

.quickstart-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 768px) {
  .quickstart-layout {
    grid-template-columns: 1fr 1fr;
  }
}

.qs-card-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 24px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.qs-card-box:hover {
  transform: translateY(-2px);
  border-color: rgba(88, 166, 255, 0.4);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
}

.qs-card-box.highlight {
  background: rgba(88, 166, 255, 0.03);
  border-color: rgba(88, 166, 255, 0.25);
}

.qs-card-box.highlight:hover {
  border-color: rgba(88, 166, 255, 0.6);
}

.qs-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: #238636;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  text-transform: uppercase;
}

.qs-card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #c9d1d9;
}

.qs-card-box.highlight .qs-card-title {
  color: #58a6ff;
}

.qs-card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 24px 0;
  flex: 1;
}

.qs-action-wrapper {
  margin-top: auto;
}

.qs-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.qs-btn-primary:hover {
  background: #2ea043;
}

.qs-btn-icon {
  width: 16px;
  height: 16px;
}

/* Method 2: Manual config & CLI styles */
.qs-form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 18px;
}

@media (min-width: 480px) {
  .qs-form-grid {
    grid-template-columns: 1.2fr 1fr;
  }
}

.qs-form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qs-form-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.qs-form-input {
  height: 34px;
  padding: 0 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.qs-form-input:focus {
  border-color: var(--accent);
}

/* Real config list */
.qs-real-config {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 18px;
}

.qs-config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.qs-config-row:last-child {
  border-bottom: none;
}

.qs-config-label {
  color: var(--text-secondary);
  font-weight: 500;
  width: 120px;
  flex-shrink: 0;
}

.qs-config-val {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #58a6ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.qs-config-copy {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.qs-config-copy:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

/* Step block */
.qs-step-block {
  margin-bottom: 18px;
}

.qs-step-title {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  margin-bottom: 10px;
}

.qs-download-row {
  display: flex;
}

.qs-download-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(88, 166, 255, 0.1);
  border: 1px solid rgba(88, 166, 255, 0.25);
  color: #58a6ff;
  border-radius: 8px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
  width: 100%;
}

.qs-download-link:hover {
  background: rgba(88, 166, 255, 0.18);
  border-color: rgba(88, 166, 255, 0.5);
}

/* Terminal / code toggle */
.qs-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.qs-tab {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.qs-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.qs-tab.active {
  background: rgba(88, 166, 255, 0.15);
  color: #58a6ff;
  font-weight: 600;
}

.qs-mode-selector {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-bottom: 20px;
}

.qs-mode-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.qs-mode-btn:hover {
  color: var(--text-primary);
}

.qs-mode-btn.active {
  background: var(--bg-surface, rgba(88, 166, 255, 0.15));
  color: #58a6ff;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.qs-mode-btn.magisk-qs-mode.active {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.qs-terminal {
  position: relative;
  background: #0d1117;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  padding-bottom: 40px;
}

.qs-code-text {
  margin: 0;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11.5px;
  color: #c9d1d9;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}

.qs-copy-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.qs-copy-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.qs-download-link.magisk-qs-btn {
  background: rgba(168, 85, 247, 0.1);
  border-color: rgba(168, 85, 247, 0.4);
  color: #c084fc;
}

.qs-download-link.magisk-qs-btn:hover {
  background: rgba(168, 85, 247, 0.2);
  border-color: #a855f7;
  color: #e9d5ff;
}

/* Warning and prerequisite styles */
.qs-card-desc-warn {
  font-size: 11.5px;
  color: #ff7675;
  margin-top: -12px;
  margin-bottom: 20px;
  line-height: 1.5;
  background: rgba(255, 118, 117, 0.08);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 118, 117, 0.15);
}

.qs-prerequisites {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 20px;
}

.qs-prereq-title {
  font-size: 12px;
  font-weight: 600;
  color: #ff9f43;
  margin-bottom: 6px;
}

.qs-prereq-list {
  margin: 0;
  padding-left: 18px;
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.qs-prereq-list li {
  margin-bottom: 4px;
}

.qs-prereq-list li:last-child {
  margin-bottom: 0;
}
</style>
