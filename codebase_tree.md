.
├── codebase.md
├── codebase_tree.md
├── images
│   ├── chatgpt_logo.png
│   ├── claude_logo.png
│   ├── deepseek_logo.png
│   ├── gemini_logo.png
│   ├── grok_logo.png
│   ├── icon128.png
│   ├── icon16.png
│   ├── icon48.png
│   └── mistral_logo.png
├── manifest.json
├── nexus-ai-v1.0.0.zip
├── package.json
├── package-lock.json
├── platform-api-config.json
├── platform-display-config.json
├── popup.html
├── postcss.config.js
├── presentation
│   ├── board.html
│   ├── board.png
│   ├── chat.png
│   ├── chat.xcf
│   ├── demo.mp4
│   ├── description.txt
│   ├── example1.png
│   ├── example2.png
│   └── example3.png
├── prompt-config.json
├── README.md
├── settings.html
├── sidepanel.html
├── src
│   ├── api
│   │   ├── api-base.js
│   │   ├── api-factory.js
│   │   ├── api-interface.js
│   │   └── implementations
│   │       ├── chatgpt-api.js
│   │       ├── claude-api.js
│   │       ├── deepseek-api.js
│   │       ├── gemini-api.js
│   │       ├── grok-api.js
│   │       └── mistral-api.js
│   ├── background
│   │   ├── api
│   │   │   └── api-coordinator.js
│   │   ├── core
│   │   │   ├── message-router.js
│   │   │   └── state-manager.js
│   │   ├── index.js
│   │   ├── initialization.js
│   │   ├── listeners
│   │   │   ├── tab-listener.js
│   │   │   └── tab-state-listener.js
│   │   └── services
│   │       ├── content-extraction.js
│   │       ├── content-processing.js
│   │       ├── credential-manager.js
│   │       ├── platform-integration.js
│   │       ├── sidebar-manager.js
│   │       └── theme-service.js
│   ├── components
│   │   ├── core
│   │   │   ├── Button.jsx
│   │   │   ├── CustomSelect.jsx
│   │   │   └── Toggle.jsx
│   │   ├── feedback
│   │   │   ├── NotificationContext.jsx
│   │   │   ├── StatusMessage.jsx
│   │   │   └── Toast.jsx
│   │   ├── form
│   │   │   ├── SelectList.jsx
│   │   │   ├── SliderInput.jsx
│   │   │   └── TextArea.jsx
│   │   ├── index.js
│   │   ├── input
│   │   │   ├── PromptDropdown.jsx
│   │   │   └── UnifiedInput.jsx
│   │   └── layout
│   │       ├── AppHeader.jsx
│   │       ├── Card.jsx
│   │       ├── PlatformCard.jsx
│   │       └── Tooltip.jsx
│   ├── content
│   │   ├── index.js
│   │   └── platform-content.js
│   ├── contexts
│   │   ├── ContentContext.jsx
│   │   ├── platform
│   │   │   ├── index.js
│   │   │   ├── PopupPlatformContext.jsx
│   │   │   ├── SidebarPlatformContext.jsx
│   │   │   └── TabAwarePlatformContext.jsx
│   │   └── UIContext.jsx
│   ├── extractor
│   │   ├── base-extractor.js
│   │   ├── extractor-factory.js
│   │   └── strategies
│   │       ├── general-strategy.js
│   │       ├── pdf-strategy.js
│   │       ├── reddit-strategy.js
│   │       └── youtube-strategy.js
│   ├── hooks
│   │   └── useContentProcessing.js
│   ├── platforms
│   │   ├── implementations
│   │   │   ├── chatgpt-platform.js
│   │   │   ├── claude-platform.js
│   │   │   ├── deepseek-platform.js
│   │   │   ├── gemini-platform.js
│   │   │   ├── grok-platform.js
│   │   │   └── mistral-platform.js
│   │   ├── platform-base.js
│   │   ├── platform-factory.js
│   │   └── platform-interface.js
│   ├── popup
│   │   ├── components
│   │   │   ├── InfoPanel.jsx
│   │   │   └── PlatformSelector.jsx
│   │   ├── contexts
│   │   │   └── StatusContext.jsx
│   │   ├── index.jsx
│   │   └── Popup.jsx
│   ├── services
│   │   ├── ApiServiceManager.js
│   │   ├── ConfigService.js
│   │   ├── ContentFormatter.js
│   │   ├── CredentialManager.js
│   │   ├── ModelParameterService.js
│   │   ├── SidebarStateManager.js
│   │   └── UIService.js
│   ├── settings
│   │   ├── components
│   │   │   ├── layout
│   │   │   │   ├── TabContent.jsx
│   │   │   │   └── TabNavigation.jsx
│   │   │   ├── tabs
│   │   │   │   ├── ApiSettings.jsx
│   │   │   │   └── PromptManagement.jsx
│   │   │   └── ui
│   │   │       ├── api
│   │   │       │   ├── AdvancedSettings.jsx
│   │   │       │   ├── PlatformDetails.jsx
│   │   │       │   └── PlatformSidebar.jsx
│   │   │       └── prompts
│   │   │           ├── PromptDetail.jsx
│   │   │           ├── PromptForm.jsx
│   │   │           └── PromptList.jsx
│   │   ├── contexts
│   │   │   └── TabContext.jsx
│   │   ├── index.jsx
│   │   └── SettingsApp.jsx
│   ├── shared
│   │   ├── constants.js
│   │   ├── logger.js
│   │   └── utils
│   │       ├── content-utils.js
│   │       ├── debounce.js
│   │       ├── error-utils.js
│   │       ├── icon-utils.js
│   │       ├── message-utils.js
│   │       └── prompt-utils.js
│   ├── sidebar
│   │   ├── components
│   │   │   ├── ChatArea.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── messaging
│   │   │   │   ├── EnhancedCodeBlock.jsx
│   │   │   │   ├── icons
│   │   │   │   │   └── CopyButtonIcon.jsx
│   │   │   │   ├── MathFormulaBlock.jsx
│   │   │   │   ├── MessageBubble.jsx
│   │   │   │   └── utils
│   │   │   │       ├── clipboard.js
│   │   │   │       └── parseTextAndMath.js
│   │   │   ├── ModelSelector.jsx
│   │   │   ├── TokenCounter.jsx
│   │   │   └── UserInput.jsx
│   │   ├── contexts
│   │   │   └── SidebarChatContext.jsx
│   │   ├── hooks
│   │   │   └── useTokenTracking.js
│   │   ├── index.jsx
│   │   ├── services
│   │   │   ├── ChatHistoryService.js
│   │   │   └── TokenManagementService.js
│   │   └── SidebarApp.jsx
│   └── styles
│       └── index.css
├── tailwind.config.js
└── webpack.config.js

48 directories, 147 files
