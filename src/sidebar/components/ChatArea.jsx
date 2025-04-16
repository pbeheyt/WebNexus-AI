// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { debounce } from '../../shared/utils/debounce';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from './messaging/MessageBubble';
import { Toggle } from '../../components/core/Toggle';
import { Tooltip } from '../../components/layout/Tooltip';
import { useContent } from '../../contexts/ContentContext';
import { CONTENT_TYPES, MESSAGE_ROLES } from '../../shared/constants';
import { getContentTypeIconSvg } from '../../shared/utils/icon-utils';
import { isInjectablePage } from '../../shared/utils/content-utils';
import logger from '../../shared/logger';

// --- Icon Definitions ---
const InputTokenIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 18V6M7 11l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const OutputTokenIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 6v12M7 13l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const ContextWindowIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 21H3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 3L14 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 21L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const FreeTierIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const ScrollDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);
// --- End Icon Definitions ---

// --- Helper Function ---
const formatContextWindow = (value) => {
    if (typeof value !== 'number') return '';
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (value >= 1000) {
        return (value / 1000).toFixed(0) + 'K';
    }
    return value.toString();
};
// --- End Helper Function ---

function ChatArea({ className = '' }) {
    const {
        messages,
        isContentExtractionEnabled,
        setIsContentExtractionEnabled,
        modelConfigData
    } = useSidebarChat();
    const { contentType, currentTab } = useContent();
    const messagesEndRef = useRef(null); // Anchor for scrolling to actual bottom
    const scrollContainerRef = useRef(null); // Ref for the scrollable div
    const [hoveredElement, setHoveredElement] = useState(null);
    const inputPriceRef = useRef(null);
    const outputPriceRef = useRef(null);
    const contextWindowRef = useRef(null);
    const freeTierRef = useRef(null);
    const {
        platforms,
        selectedPlatformId,
        selectedModel,
        hasAnyPlatformCredentials,
    } = useSidebarPlatform();

    // --- State ---
    const [showScrollDownButton, setShowScrollDownButton] = useState(false);
    // No longer need placeholderStyleInfo state
    const [displayPlatformConfig, setDisplayPlatformConfig] = useState(null);
    const [displayModelConfig, setDisplayModelConfig] = useState(null);
    const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);

    // --- Effect for Platform/Model Display ---
     useEffect(() => {
        const targetPlatform = platforms.find(p => p.id === selectedPlatformId);
        const isModelConfigReady = modelConfigData && selectedModel && modelConfigData.id === selectedModel;
        const isPlatformReady = !!targetPlatform;

        if (isPlatformReady && isModelConfigReady) {
            setDisplayPlatformConfig({
                id: targetPlatform.id,
                name: targetPlatform.name,
                iconUrl: targetPlatform.iconUrl
            });
            setDisplayModelConfig(modelConfigData);
            if (!hasCompletedInitialLoad) {
                setHasCompletedInitialLoad(true);
            }
        } else {
             setDisplayPlatformConfig(null);
             setDisplayModelConfig(null);
             if (hasAnyPlatformCredentials && hasCompletedInitialLoad) {
                 // Maintain completion if creds exist but config mismatch
             } else {
                 setHasCompletedInitialLoad(false);
             }
        }
    }, [platforms, selectedPlatformId, modelConfigData, selectedModel, hasCompletedInitialLoad, hasAnyPlatformCredentials]);

    // --- Get Content Type Name ---
    const getContentTypeName = (type) => {
        switch (type) {
            case CONTENT_TYPES.YOUTUBE: return "YouTube Video";
            case CONTENT_TYPES.REDDIT: return "Reddit Post";
            case CONTENT_TYPES.PDF: return "PDF Document";
            case CONTENT_TYPES.GENERAL: return "Web Page";
            default: return "Content";
        }
    };
    // --- End Get Content Type Name ---

    // --- Scroll Handling Logic ---
    const SCROLL_THRESHOLD = 50;
    const DEBOUNCE_DELAY = 200;

    // --- Scrolling Effect (Applying ChatGPT-like structure) ---
    useLayoutEffect(() => {
        if (messages.length === 0 || !scrollContainerRef.current) {
            // Ensure button is hidden if no messages
            setShowScrollDownButton(false);
            return;
        }

        const scrollContainer = scrollContainerRef.current;
        const lastMessage = messages[messages.length - 1];
        const secondLastMessage = messages.length > 1 ? messages[messages.length - 2] : null;

        // Condition: User just sent a message (last is placeholder, previous is user)
        const userJustSent = secondLastMessage &&
                             secondLastMessage.role === MESSAGE_ROLES.USER &&
                             lastMessage.role === MESSAGE_ROLES.ASSISTANT &&
                             lastMessage.isStreaming === true;

        let scrollTargetElement = null;
        let scrollOptions = { behavior: 'auto', block: 'end' }; // Default: instant scroll to end

        if (userJustSent && lastMessage.id) {
             // --- User Just Sent: Scroll Placeholder to Top ---
            scrollTargetElement = document.getElementById(lastMessage.id);
            scrollOptions = { behavior: 'auto', block: 'start' }; // Instant scroll to top
            setShowScrollDownButton(false); // Hide button immediately
            logger.sidebar.debug(`[ChatArea] User sent. Scrolling placeholder ${lastMessage.id} to start.`);

        } else {
            // --- Other Cases (Streaming, Finished, Initial Load) ---
            const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
            const isNearBottom = scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD + 5; // Add tolerance
            const isAssistantStreaming = lastMessage.role === MESSAGE_ROLES.ASSISTANT && lastMessage.isStreaming;

            if (isNearBottom || isAssistantStreaming) {
                // Auto-scroll smoothly to the general end anchor if near bottom OR still streaming
                scrollTargetElement = messagesEndRef.current;
                scrollOptions = { behavior: 'smooth', block: 'end' };
                logger.sidebar.debug(`[ChatArea] Default scroll: near bottom or assistant streaming. Scrolling to end anchor.`);
            } else {
                // User scrolled up, don't scroll automatically
                scrollTargetElement = null;
                logger.sidebar.debug('[ChatArea] User scrolled up & assistant not streaming, not auto-scrolling.');
            }
             // Check button visibility in these cases too
             checkScrollPosition();
        }

        // Perform Scrolling
        if (scrollTargetElement) {
            requestAnimationFrame(() => {
                // Use ref directly if possible, otherwise use ID
                 const target = scrollTargetElement === messagesEndRef.current
                               ? messagesEndRef.current
                               : document.getElementById(lastMessage.id); // Fetch last element by ID if needed

                target?.scrollIntoView(scrollOptions);
                logger.sidebar.debug(`[ChatArea] Scrolled target ${target?.id || 'endRef'} with options:`, scrollOptions);
            });
        }

    // Depend only on messages array. Internal logic decides scroll target/behavior.
    }, [messages]);


    // --- Manual Scroll To Bottom Function ---
    const scrollToBottom = useCallback((behavior = 'smooth') => {
        logger.sidebar.debug('[ChatArea] scrollToBottom called manually');
        messagesEndRef.current?.scrollIntoView({ behavior: behavior, block: 'end' });
    }, []);

    // --- Function to Check Scroll Position (for Scroll Down Button) ---
    const checkScrollPosition = useCallback(() => {
         if (messages.length === 0) {
            setShowScrollDownButton(false); return;
        }
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) {
            logger.sidebar.warn('[ChatArea] checkScrollPosition: scrollContainerRef is null'); return;
        }
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const scrollFromBottom = scrollHeight - scrollTop - clientHeight;
        const isNearBottom = scrollFromBottom <= SCROLL_THRESHOLD + 5; // Add tolerance

        const lastMsg = messages[messages.length - 1];
        const isAssistantStreaming = lastMsg?.role === MESSAGE_ROLES.ASSISTANT && lastMsg?.isStreaming;
        // Show if scrolled up AND assistant is NOT streaming
        const shouldShow = !isNearBottom && !isAssistantStreaming;

        setShowScrollDownButton(prev => {
            if (prev !== shouldShow) {
                 logger.sidebar.info(`[ChatArea] Setting showScrollDownButton to: ${shouldShow} (isNearBottom: ${isNearBottom}, scrollFromBottom: ${scrollFromBottom.toFixed(1)}, isAssistantStreaming: ${isAssistantStreaming})`);
            }
            return shouldShow;
        });
    }, [messages, SCROLL_THRESHOLD]);


    // --- Debounced Scroll Position Check ---
     const debouncedCheckScrollPosition = useMemo(
        () => debounce(checkScrollPosition, DEBOUNCE_DELAY),
        [checkScrollPosition]
    );

    // --- Effect for Manual Scroll Listener ---
    useEffect(() => {
         const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
            logger.sidebar.info('[ChatArea] Adding scroll listener for manual scroll.');
            scrollContainer.addEventListener('scroll', debouncedCheckScrollPosition, { passive: true });
             // Check position slightly after initial render/scroll effect
            const timerId = setTimeout(checkScrollPosition, 100);

            return () => {
                clearTimeout(timerId);
                logger.sidebar.info('[ChatArea] Removing scroll listener for manual scroll.');
                scrollContainer.removeEventListener('scroll', debouncedCheckScrollPosition);
                debouncedCheckScrollPosition?.cancel();
            };
        }
    }, [debouncedCheckScrollPosition, checkScrollPosition]);


    // --- Effect to check scroll on content update (during streaming) ---
    const lastMessageContent = messages.length > 0 ? messages[messages.length - 1]?.content : null;
    const lastMessageStreaming = messages.length > 0 ? messages[messages.length - 1]?.isStreaming : false;
    useEffect(() => {
         if (lastMessageStreaming && lastMessageContent) {
             // Check button visibility immediately when streaming content updates
             checkScrollPosition();
         }
         // Also check when streaming *stops*
         if (!lastMessageStreaming && messages.length > 0) {
             checkScrollPosition();
         }
    }, [lastMessageContent, lastMessageStreaming, checkScrollPosition, messages.length]); // Added messages.length dependency


    logger.sidebar.debug(`[ChatArea] Rendering with showScrollDownButton state: ${showScrollDownButton}`);

    // --- Open API Settings ---
    const openApiSettings = () => {
        try {
            if (chrome && chrome.tabs && chrome.runtime) {
                chrome.tabs.create({ url: chrome.runtime.getURL('settings.html#api-settings') });
            } else {
                console.warn("Chrome APIs not available. Cannot open settings tab.");
            }
        } catch (error) {
            console.error('Could not open API options page:', error);
        }
    };
    // --- End Open API Settings ---

    const isPageInjectable = currentTab?.url ? isInjectablePage(currentTab.url) : false;

    // --- Render Initial View Content (Helper Function) ---
     const renderInitialView = () => {
         if (!hasAnyPlatformCredentials) {
            return (
                <div className={`flex flex-col items-center justify-center h-full text-theme-secondary text-center px-5`}>
                    <button
                        onClick={openApiSettings}
                        className="flex flex-col items-center p-4 rounded-lg hover:bg-theme-hover transition-colors w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-dark"
                        aria-label="Configure API Credentials in Settings"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-3 text-theme-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1.51-1V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H15a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <h3 className="text-base font-semibold mb-2">API Credentials Required</h3>
                        <p className="text-sm">
                            Click here to configure API keys in settings.
                        </p>
                    </button>
                </div>
            );
        }
        // Show loading only if creds exist but initial load isn't finished
        if (hasAnyPlatformCredentials && !hasCompletedInitialLoad) {
            return (
                <div className={`flex items-center justify-center h-full`}>
                    <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading model information"></div>
                </div>
            );
        }
        // Show main initial view once creds exist AND initial load is done
         if (hasAnyPlatformCredentials && hasCompletedInitialLoad) {
             const modelReady = !!displayModelConfig; // Check if specific model details are loaded

            return (
                <div className={`flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5 py-3`}>
                     {/* SECTION 1: Platform Logo, Model Name, and Details Section */}
                     <div className="flex flex-col items-center py-3 w-full min-h-[120px]"> {/* Added min-height */}
                         {displayPlatformConfig ? (
                             <img
                                 src={displayPlatformConfig.iconUrl}
                                 alt={`${displayPlatformConfig.name || 'Platform'} logo`}
                                 className="w-8 h-8 mb-2 object-contain"
                             />
                         ) : (
                             <div className="w-8 h-8 mb-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div> // Placeholder
                         )}
                         {modelReady ? ( // Use modelReady flag
                             <>
                                 <div className="text-sm text-theme-primary dark:text-theme-primary-dark font-medium" title={displayModelConfig.id}>
                                     {displayModelConfig.name || displayModelConfig.id}
                                 </div>
                                 {displayModelConfig.description && (
                                     <p className="text-xs text-theme-secondary text-center mt-1 mb-2 max-w-xs mx-auto">
                                         {displayModelConfig.description}
                                     </p>
                                 )}
                                 <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-theme-secondary mt-1">
                                     {/* ... (rest of the model details rendering - unchanged) ... */}
                                      {displayModelConfig.inputTokenPrice === 0 && displayModelConfig.outputTokenPrice === 0 ? (
                                         <div ref={freeTierRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('freeTier')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('freeTier')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                                             <FreeTierIcon /> <span>Free</span>
                                             <Tooltip show={hoveredElement === 'freeTier'} message="This model is currently free to use via API." targetRef={freeTierRef} position="bottom" />
                                         </div>
                                     ) : (
                                         <>
                                             {typeof displayModelConfig.inputTokenPrice === 'number' && displayModelConfig.inputTokenPrice >= 0 && (
                                                 <div ref={inputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('inputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('inputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                                                     <InputTokenIcon /> <span>{`$${displayModelConfig.inputTokenPrice.toFixed(2)}`}</span>
                                                     <Tooltip show={hoveredElement === 'inputPrice'} message={`$${displayModelConfig.inputTokenPrice.toFixed(2)} / 1M input tokens.`} targetRef={inputPriceRef} position="bottom" />
                                                 </div>
                                             )}
                                             {typeof displayModelConfig.outputTokenPrice === 'number' && displayModelConfig.outputTokenPrice > 0 && (
                                                 <div ref={outputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('outputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('outputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                                                     <OutputTokenIcon /> <span>{`$${displayModelConfig.outputTokenPrice.toFixed(2)}`}</span>
                                                     <Tooltip show={hoveredElement === 'outputPrice'} message={`$${displayModelConfig.outputTokenPrice.toFixed(2)} / 1M output tokens.`} targetRef={outputPriceRef} position="bottom" />
                                                 </div>
                                             )}
                                         </>
                                     )}
                                     {typeof displayModelConfig.contextWindow === 'number' && displayModelConfig.contextWindow > 0 && (
                                         <div ref={contextWindowRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('contextWindow')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('contextWindow')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                                             <ContextWindowIcon /> <span>{formatContextWindow(displayModelConfig.contextWindow)}</span>
                                             <Tooltip show={hoveredElement === 'contextWindow'} message={`Max context window: ${displayModelConfig.contextWindow.toLocaleString()} tokens.`} targetRef={contextWindowRef} position="bottom" />
                                         </div>
                                     )}

                                 </div>
                             </>
                         ) : (
                             // Skeleton loader for model details
                             <div className="animate-pulse flex flex-col items-center w-full mt-1">
                                 <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2"></div>
                                 <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-3"></div>
                                 <div className="flex flex-row gap-3">
                                     <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                                     <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                                     <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                                 </div>
                              </div>
                         )}
                     </div>

                     {/* SECTION 2: Start a conversation message Section */}
                     <div className="flex flex-col items-center py-3 w-full">
                         <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
                         <p className="text-xs max-w-xs mx-auto">
                             {getWelcomeMessage(contentType, isPageInjectable)}
                         </p>
                     </div>

                     {/* SECTION 3: Content Type / Extraction Info Section */}
                     <div className="flex flex-col items-center py-3 w-full">
                         {isPageInjectable ? (
                             <>
                                 {getContentTypeIconSvg(contentType) && (
                                     <div className="mb-3">
                                         <div
                                             className="inline-flex items-center px-4 py-2 rounded-full shadow-sm bg-gray-100 dark:bg-gray-800 text-theme-primary dark:text-theme-primary-dark"
                                             aria-label={`Current content type: ${getContentTypeName(contentType)}`}
                                         >
                                             <div
                                                 className="mr-3 flex-shrink-0 w-5 h-5"
                                                 dangerouslySetInnerHTML={{ __html: getContentTypeIconSvg(contentType) }}
                                                 aria-hidden="true"
                                             />
                                             <span className="text-sm font-medium">
                                                 {getContentTypeName(contentType)}
                                             </span>
                                         </div>
                                     </div>
                                 )}
                                 <div className="flex items-center gap-3 text-xs text-theme-secondary">
                                     <label htmlFor="content-extract-toggle" className="cursor-pointer">Extract content</label>
                                     <Toggle
                                         id="content-extract-toggle"
                                         checked={isContentExtractionEnabled}
                                         onChange={() => setIsContentExtractionEnabled(prev => !prev)}
                                         disabled={!hasAnyPlatformCredentials}
                                         className='w-10 h-5'
                                     />
                                 </div>
                             </>
                         ) : (
                             <div className="mb-2">
                                 <span className="text-xs text-theme-secondary">
                                     This page content cannot be extracted.
                                 </span>
                             </div>
                         )}
                     </div>
                 </div>
            );
        }
        // Fallback if !hasAnyPlatformCredentials (handled first)
        // Or if initial load fails for some reason
        return null;
    };
    // --- End Initial View Rendering ---

    // --- Main Component Render ---
    return (
        <div className={`flex-1 flex flex-col relative ${className}`}>
            {/* Scrollable container */}
            <div
                ref={scrollContainerRef}
                // Added scrollbar-gutter: stable to mimic ChatGPT and prevent layout shifts
                className="flex-1 overflow-y-auto flex flex-col pt-4" style={{ scrollbarGutter: 'stable' }}
            >
                {/* Conditional Content Inside Scrollable Container */}
                {messages.length === 0 ? (
                    renderInitialView()
                ) : (
                    <>
                        {/* Render Messages */}
                        {messages.map((message, index) => {
                           // Determine style ONLY for the very last message
                           const isLastMessage = index === messages.length - 1;
                           let dynamicStyle = {};

                           if (isLastMessage) {
                               // ================= IMPORTANT ADJUSTMENT ==================
                               // ** Adjust '160px' based on the combined height of your **
                               // ** AppHeader, Header (when expanded), and UserInput.    **
                               const estimatedOtherUIHeight = '160px';
                               // =========================================================
                               dynamicStyle = {
                                   // Apply min-height to push content up and create space below
                                   minHeight: `calc(100vh - ${estimatedOtherUIHeight})`,
                                   // Add scroll-margin-top like ChatGPT to prevent top UI overlap
                                   scrollMarginTop: '12px', // Adjust as needed
                                   // Ensure smooth transition when height might change (e.g., streaming ends)
                                   transition: 'min-height 0.2s ease-out'
                               };
                               logger.sidebar.debug(`Applying dynamic style to last message: ${message.id}`, dynamicStyle);
                           }

                            return (
                                <MessageBubble
                                    key={message.id}
                                    id={message.id} // Pass ID for targeting
                                    content={message.content}
                                    role={message.role}
                                    isStreaming={message.isStreaming}
                                    model={message.model}
                                    platformIconUrl={message.platformIconUrl}
                                    style={dynamicStyle} // Apply the calculated style to the last message
                                />
                            );
                        })}

                        {/* Scroll Anchor (for manual scroll to bottom) */}
                        {/* Placed AFTER the loop */}
                        <div ref={messagesEndRef} style={{ height: '1px' }} aria-hidden="true" />
                    </>
                )}
            </div>

            {/* Scroll Down Button */}
            <button
                onClick={() => scrollToBottom('smooth')}
                className={`
                    absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10
                    p-1.5 rounded-full shadow-md
                    bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
                    text-theme-primary dark:text-theme-primary-dark
                    transition-opacity duration-300 ease-in-out
                    ${showScrollDownButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
                aria-label="Scroll to bottom"
                title="Scroll to bottom"
                aria-hidden={!showScrollDownButton}
                tabIndex={showScrollDownButton ? 0 : -1}
            >
                <ScrollDownIcon />
            </button>
        </div>
    );
}

// --- getWelcomeMessage ---
function getWelcomeMessage(contentType, isPageInjectable) {
    if (!isPageInjectable) {
        return "Ask me anything! Type your question or prompt below.";
    }
    switch (contentType) {
        case CONTENT_TYPES.YOUTUBE:
            return "Ask about this YouTube video or request a summary.";
        case CONTENT_TYPES.REDDIT:
            return "Ask me anything about this Reddit post or request key takeaways.";
        case CONTENT_TYPES.PDF:
            return "Ask specific questions about this PDF document or request a summary.";
        case CONTENT_TYPES.GENERAL:
        default:
            return "Ask about this page's content, request a summary, or start a related chat.";
    }
}

export default ChatArea;