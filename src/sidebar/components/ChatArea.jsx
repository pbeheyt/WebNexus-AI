// src/sidebar/components/ChatArea.jsx
import React, {
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
    useLayoutEffect,
  } from 'react';
  import PropTypes from 'prop-types';

  import { debounce } from '../../shared/utils/debounce';
  import { useSidebarChat } from '../contexts/SidebarChatContext';
  import { useSidebarPlatform } from '../../contexts/platform';
  import { useUI } from '../../contexts/UIContext';
  import { Toggle } from '../../components/core/Toggle';
  import { Tooltip } from '../../components';
  import { PlatformIcon } from '../../components/layout/PlatformIcon';
  import { useContent } from '../../contexts/ContentContext';
  import { CONTENT_TYPES, CONTENT_TYPE_LABELS, MESSAGE_ROLES } from '../../shared/constants';
  import { ContentTypeIcon } from '../../components/layout/ContentTypeIcon';
  import { isInjectablePage } from '../../shared/utils/content-utils';
  import { logger } from '../../shared/logger';
  import {
    InputTokenIcon,
    OutputTokenIcon,
    ContextWindowIcon,
    FreeTierIcon,
    ScrollDownIcon,
    NoCredentialsIcon,
  } from '../../components';
  
  import { MessageBubble } from './messaging/MessageBubble';
  
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
  
  // --- Constants ---
  const MIN_ASSISTANT_BUBBLE_HEIGHT_REM = 2; // Equivalent to 2rem minimum height
  
  function ChatArea({
    className = '',
    otherUIHeight = 160,
    requestHeightRecalculation,
  }) {
    const {
      messages,
      isContentExtractionEnabled,
      setIsContentExtractionEnabled,
      modelConfigData,
    } = useSidebarChat();
    const { contentType, currentTab } = useContent();
    const { textSize } = useUI();
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
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
    const [isIncludeTooltipVisible, setIsIncludeTooltipVisible] = useState(false);
    const [showScrollDownButton, setShowScrollDownButton] = useState(false);
    const [displayPlatformConfig, setDisplayPlatformConfig] = useState(null);
    const [displayModelConfig, setDisplayModelConfig] = useState(null);
    const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
    const [precedingUserMessageHeight, setPrecedingUserMessageHeight] =
      useState(0);
    const precedingUserMessageRef = useRef(null);
    const [
      initialScrollCompletedForResponse,
      setInitialScrollCompletedForResponse,
    ] = useState(true);
    const rafIdHeightCalc = useRef(null);
    const showButtonTimerRef = useRef(null);

    const includeToggleRef = useRef(null);
    // --- Effect for Platform/Model Display ---
    useEffect(() => {
      const targetPlatform = platforms.find((p) => p.id === selectedPlatformId);
      const isPlatformReady = !!targetPlatform;
      const isModelConfigReadyForSelection =
        modelConfigData && selectedModel && modelConfigData.id === selectedModel;
    
      if (isPlatformReady && isModelConfigReadyForSelection) {
        setDisplayPlatformConfig({
          id: targetPlatform.id,
          name: targetPlatform.name,
          iconUrl: targetPlatform.iconUrl,
        });
        setDisplayModelConfig(modelConfigData);
        if (!hasCompletedInitialLoad) {
          setHasCompletedInitialLoad(true);
        }
      }
    }, [
      platforms,
      selectedPlatformId,
      modelConfigData,
      selectedModel,
      hasCompletedInitialLoad,
      hasAnyPlatformCredentials,
    ]);
  
  
    // --- getWelcomeMessage ---
    function getWelcomeMessage(contentType, isPageInjectable) {
      if (!isPageInjectable) {
        return 'Ask me anything! Type your question or prompt below.';
      }
      switch (contentType) {
        case CONTENT_TYPES.YOUTUBE:
          return 'Ask about this YouTube video or request a summary.';
        case CONTENT_TYPES.REDDIT:
          return 'Ask me anything about this Reddit post or request key takeaways.';
        case CONTENT_TYPES.PDF:
          return 'Ask specific questions about this PDF document or request a summary.';
        case CONTENT_TYPES.GENERAL:
        default:
          return "Ask about this page's content, request a summary, or start a related chat.";
      }
    }
  
    // --- Scroll Handling Logic ---
    const SCROLL_THRESHOLD = 10;
    const DEBOUNCE_DELAY = 100;
  
  // --- Function to Check Scroll Position (for Scroll Down Button) ---
  const checkScrollPosition = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || messages.length === 0) {
      if (showScrollDownButton) setShowScrollDownButton(false);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const scrollFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = scrollFromBottom <= SCROLL_THRESHOLD + 10;
    
    const lastMsg = messages[messages.length - 1];
    const forceHideButton =
    lastMsg &&
    (lastMsg.role === MESSAGE_ROLES.ASSISTANT ||
      lastMsg.role === MESSAGE_ROLES.SYSTEM) &&
      lastMsg.isStreaming === true &&
      (!lastMsg.content || lastMsg.content.trim() === '');
      
      const shouldShow = !isNearBottom && !forceHideButton;
      if (shouldShow) {
        // Only schedule show if it's not already showing and no timer is pending
        if (!showScrollDownButton && !showButtonTimerRef.current) {
           showButtonTimerRef.current = setTimeout(() => {
             setShowScrollDownButton(true);
             showButtonTimerRef.current = null; // Clear ref after execution
           }, 500); // 500ms delay before showing
        }
      } else {
        // If it should be hidden, clear any pending show timer and hide immediately
        if (showButtonTimerRef.current) {
          clearTimeout(showButtonTimerRef.current);
          showButtonTimerRef.current = null;
        }
        if (showScrollDownButton) {
           setShowScrollDownButton(false);
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, showScrollDownButton, SCROLL_THRESHOLD, textSize]);
  
    // --- Define last/secondLast message OUTSIDE the effect ---
    const lastMessage = messages[messages.length - 1];
    const secondLastMessage =
      messages.length > 1 ? messages[messages.length - 2] : null;
  
    // --- Scrolling Effect ---
    useLayoutEffect(() => {
      // Early exit if no messages or container ref not ready
      if (messages.length === 0 || !scrollContainerRef.current) {
        if (showScrollDownButton) setShowScrollDownButton(false);
        return;
      }
  
      // --- Condition 1: Reset flag when assistant finishes ---
      const assistantJustFinished =
        lastMessage &&
        (lastMessage.role === MESSAGE_ROLES.ASSISTANT ||
          lastMessage.role === MESSAGE_ROLES.SYSTEM) &&
        !lastMessage.isStreaming;
  
      if (assistantJustFinished && initialScrollCompletedForResponse) {
        setInitialScrollCompletedForResponse(false);
      }
  
      // --- Condition 2: Reset flag when a new user message is added ---
      if (
        lastMessage &&
        lastMessage.role === MESSAGE_ROLES.USER &&
        initialScrollCompletedForResponse
      ) {
        setInitialScrollCompletedForResponse(false);
      }
  
      // --- Condition 3: Perform the initial scroll when assistant starts ---
      const assistantJustStarted =
        secondLastMessage &&
        secondLastMessage.role === MESSAGE_ROLES.USER &&
        lastMessage &&
        (lastMessage.role === MESSAGE_ROLES.ASSISTANT ||
          lastMessage.role === MESSAGE_ROLES.SYSTEM) &&
        lastMessage.isStreaming === true;
  
      if (assistantJustStarted && !initialScrollCompletedForResponse) {
        const userMessageElementId = secondLastMessage?.id; // Get the ID
  
        if (userMessageElementId) {
          // Outer rAF (implicit in useLayoutEffect or explicit if needed)
          requestAnimationFrame(() => {
            // Nested rAF for scroll calculation and execution
            requestAnimationFrame(() => {
              const currentContainer = scrollContainerRef.current;
              const currentElement =
                document.getElementById(userMessageElementId); // Get element by ID inside nested rAF
  
              if (currentContainer && currentElement) {
                const containerRect = currentContainer.getBoundingClientRect();
                const elementRect = currentElement.getBoundingClientRect();
                const scrollTargetTop =
                  currentContainer.scrollTop +
                  elementRect.top -
                  containerRect.top;
  
                currentContainer.scrollTo({
                  top: scrollTargetTop,
                  behavior: 'smooth',
                });
                setInitialScrollCompletedForResponse(true); // Mark as completed after scroll starts
              } else {
                logger.sidebar.warn(
                  `[ChatArea Scrolling Effect] Element or container not found inside *nested* rAF for ID ${userMessageElementId}.`
                );
                setInitialScrollCompletedForResponse(true); // Still mark as complete
              }
            }); // End nested rAF
          }); // End outer rAF
        } else {
          logger.sidebar.warn(
            `[ChatArea Scrolling Effect] User message element ID not found. Skipping initial scroll.`
          );
          setInitialScrollCompletedForResponse(true); // Still mark as complete
        }
      }
  
      // Always check button visibility
      checkScrollPosition();
    }, [
      messages.length,
      lastMessage?.id,
      lastMessage?.role,
      lastMessage?.isStreaming,
      secondLastMessage?.id,
      secondLastMessage?.role,
      textSize, // Include textSize
      checkScrollPosition, // Include checkScrollPosition
      initialScrollCompletedForResponse, // Include this state
      showScrollDownButton, // Include this state
      lastMessage, // Add missing dependency
      secondLastMessage, // Add missing dependency
    ]); // Ensure all relevant dependencies are listed
  
    // --- Layout Effect for Preceding User Message Height ---
    useLayoutEffect(() => {
      const isTargetScenario =
        messages.length >= 2 &&
        (messages[messages.length - 1].role === MESSAGE_ROLES.ASSISTANT ||
          messages[messages.length - 1].role === MESSAGE_ROLES.SYSTEM) &&
        messages[messages.length - 2].role === MESSAGE_ROLES.USER;
  
      if (rafIdHeightCalc.current) {
        cancelAnimationFrame(rafIdHeightCalc.current);
      }
  
      if (isTargetScenario && precedingUserMessageRef.current) {
        rafIdHeightCalc.current = requestAnimationFrame(() => {
          if (precedingUserMessageRef.current) {
            requestHeightRecalculation(); // Call the prop function
            const height = precedingUserMessageRef.current.offsetHeight;
            if (height !== precedingUserMessageHeight) {
              setPrecedingUserMessageHeight(height);
            }
          }
          rafIdHeightCalc.current = null;
        });
      } else {
        if (precedingUserMessageHeight !== 0) {
          setPrecedingUserMessageHeight(0);
        }
      }
  
      return () => {
        if (rafIdHeightCalc.current) {
          cancelAnimationFrame(rafIdHeightCalc.current);
          rafIdHeightCalc.current = null;
        }
      };
    }, [messages, precedingUserMessageHeight, textSize, requestHeightRecalculation]);
  
    // --- Manual Scroll To Bottom Function ---
    const scrollToBottom = useCallback((behavior = 'smooth') => {
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: behavior,
        });
      }
    }, []);
  
    // --- Debounced Scroll Position Check ---
    const debouncedCheckScrollPosition = useMemo(
      () => debounce(checkScrollPosition, DEBOUNCE_DELAY),
      [checkScrollPosition]
    );
  
    // Effect for cleaning up the show button timer on unmount
    useEffect(() => {
      // Return a cleanup function
      return () => {
        if (showButtonTimerRef.current) {
          clearTimeout(showButtonTimerRef.current);
        }
      };
    }, []); // Empty dependency array ensures this runs only on unmount

    // --- Effect for Manual Scroll Listener ---
    useEffect(() => {
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', debouncedCheckScrollPosition, {
          passive: true,
        });
        const timerId = setTimeout(checkScrollPosition, 100);
        return () => {
          clearTimeout(timerId);
          scrollContainer.removeEventListener(
            'scroll',
            debouncedCheckScrollPosition
          );
          debouncedCheckScrollPosition?.cancel();
        };
      }
    }, [debouncedCheckScrollPosition, checkScrollPosition]);
  
    // --- Effect to check scroll on content update (during streaming) ---
    useEffect(() => {
      const streaming = lastMessage?.isStreaming;
      const content = lastMessage?.content;
  
      if (streaming && content) {
        checkScrollPosition();
      }
      if (!streaming && messages.length > 0) {
        checkScrollPosition();
      }
    }, [
      lastMessage?.content,
      lastMessage?.isStreaming,
      checkScrollPosition,
      messages.length,
    ]);
  
    // --- Open API Settings ---
    const openApiSettings = () => {
      try {
        if (chrome && chrome.tabs && chrome.runtime) {
          chrome.tabs.create({
            url: chrome.runtime.getURL('settings.html#api-settings'),
          });
        } else {
          logger.sidebar.warn(
            'Chrome APIs not available. Cannot open settings tab.'
          );
        }
      } catch (error) {
        logger.sidebar.error('Could not open API options page:', error);
      }
    };
  
    const isPageInjectable = currentTab?.url
      ? isInjectablePage(currentTab.url)
      : false;
  
    // --- Render Initial View Content ---
    const renderInitialView = () => {
      if (!hasAnyPlatformCredentials) {
        return (
          <div
            className={`flex flex-col items-center justify-center h-full text-theme-secondary text-center px-5`}
          >
            <button
              onClick={openApiSettings}
              className='flex flex-col items-center justify-center p-4 rounded-lg hover:bg-theme-hover transition-colors w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-dark'
              aria-label='Configure API Credentials in Settings'
            >
              <NoCredentialsIcon className='w-8 h-8 mb-3 text-theme-secondary select-none' />
              <h3 className='text-base font-semibold mb-2 select-none'>
                API Credentials Required
              </h3>
              <p className='text-sm select-none'>
                Click here to configure API keys in settings.
              </p>
            </button>
          </div>
        );
      }
      if (hasAnyPlatformCredentials && !hasCompletedInitialLoad) {
        return (
          <div className={`flex items-center justify-center h-full`}>
            <div
              className='w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin select-none'
              role='status'
              aria-label='Loading model information'
            ></div>
          </div>
        );
      }
      if (hasAnyPlatformCredentials && hasCompletedInitialLoad) {
        const modelReady = !!displayModelConfig;
  
        return (
          <div
            className={`flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5 py-3`}
          >
            {/* SECTION 1: Platform Logo, Model Name, and Details Section */}
            <div className='flex flex-col items-center py-3 w-full min-h-[120px] select-none'>
              {displayPlatformConfig ? (
                <PlatformIcon
                  platformId={displayPlatformConfig.id}
                  iconUrl={displayPlatformConfig.iconUrl}
                  altText={`${displayPlatformConfig.name || 'Platform'} logo`}
                  className='w-8 h-8 mb-2 object-contain select-none'
                />
              ) : (
                <div className='w-8 h-8 mb-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse select-none'></div>
              )}
              {modelReady ? (
                <>
                  <div
                    className='text-sm text-theme-primary dark:text-theme-primary-dark font-medium select-none'
                    title={displayModelConfig.id}
                  >
                    {displayModelConfig.name || displayModelConfig.id}
                  </div>
                  {displayModelConfig.description && (
                    <p className='text-xs text-theme-secondary text-center mt-1 mb-2 max-w-xs mx-auto select-none'>
                      {displayModelConfig.description}
                    </p>
                  )}
                  <div className='flex flex-row flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-theme-secondary mt-1 select-none'>
                    {displayModelConfig.inputTokenPrice === 0 &&
                    displayModelConfig.outputTokenPrice === 0 ? (
                      <div
                        ref={freeTierRef}
                        className='flex items-center relative cursor-help'
                        onMouseEnter={() => setHoveredElement('freeTier')}
                        onMouseLeave={() => setHoveredElement(null)}
                        onFocus={() => setHoveredElement('freeTier')}
                        onBlur={() => setHoveredElement(null)}
                      >
                        <FreeTierIcon /> <span className='ml-1'>Free</span>
                        <Tooltip
                          show={hoveredElement === 'freeTier'}
                          message='This model is currently free to use via API.'
                          targetRef={freeTierRef}
                          position='bottom'
                        />
                      </div>
                    ) : (
                      <>
                        {typeof displayModelConfig.inputTokenPrice === 'number' &&
                          displayModelConfig.inputTokenPrice >= 0 && (
                            <div
                              ref={inputPriceRef}
                              className='flex items-center relative cursor-help'
                              onMouseEnter={() => setHoveredElement('inputPrice')}
                              onMouseLeave={() => setHoveredElement(null)}
                              onFocus={() => setHoveredElement('inputPrice')}
                              onBlur={() => setHoveredElement(null)}
                            >
                              <InputTokenIcon />{' '}
                              <span className='ml-1'>{`$${displayModelConfig.inputTokenPrice.toFixed(2)}`}</span>
                              <Tooltip
                                show={hoveredElement === 'inputPrice'}
                                message={`$${displayModelConfig.inputTokenPrice.toFixed(2)} / 1M input tokens.`}
                                targetRef={inputPriceRef}
                                position='bottom'
                              />
                            </div>
                          )}
                        {typeof displayModelConfig.outputTokenPrice ===
                          'number' &&
                          displayModelConfig.outputTokenPrice > 0 && (
                            <div
                              ref={outputPriceRef}
                              className='flex items-center relative cursor-help'
                              onMouseEnter={() =>
                                setHoveredElement('outputPrice')
                              }
                              onMouseLeave={() => setHoveredElement(null)}
                              onFocus={() => setHoveredElement('outputPrice')}
                              onBlur={() => setHoveredElement(null)}
                            >
                              <OutputTokenIcon />{' '}
                              <span className='ml-1'>{`$${displayModelConfig.outputTokenPrice.toFixed(2)}`}</span>
                              <Tooltip
                                show={hoveredElement === 'outputPrice'}
                                message={`$${displayModelConfig.outputTokenPrice.toFixed(2)} / 1M output tokens.`}
                                targetRef={outputPriceRef}
                                position='bottom'
                              />
                            </div>
                          )}
                      </>
                    )}
                    {typeof displayModelConfig.contextWindow === 'number' &&
                      displayModelConfig.contextWindow > 0 && (
                        <div
                          ref={contextWindowRef}
                          className='flex items-center relative cursor-help'
                          onMouseEnter={() => setHoveredElement('contextWindow')}
                          onMouseLeave={() => setHoveredElement(null)}
                          onFocus={() => setHoveredElement('contextWindow')}
                          onBlur={() => setHoveredElement(null)}
                        >
                          <ContextWindowIcon />{' '}
                          <span className='ml-1'>
                            {formatContextWindow(
                              displayModelConfig.contextWindow
                            )}
                          </span>
                          <Tooltip
                            show={hoveredElement === 'contextWindow'}
                            message={`Max context window: ${displayModelConfig.contextWindow.toLocaleString()} tokens.`}
                            targetRef={contextWindowRef}
                            position='bottom'
                          />
                        </div>
                      )}
                  </div>
                </>
              ) : (
                <div className='animate-pulse flex flex-col items-center w-full mt-1'>
                  <div className='h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2'></div>
                  <div className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-3'></div>
                  <div className='flex flex-row gap-3'>
                    <div className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-12'></div>
                    <div className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-12'></div>
                    <div className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-12'></div>
                  </div>
                </div>
              )}
            </div>
  
            {/* SECTION 2: Start a conversation message Section */}
            <div className='flex flex-col items-center py-3 w-full'>
              <h3 className='text-base font-semibold mb-2 select-none'>
                Start a conversation
              </h3>
              <p className='text-xs max-w-xs mx-auto select-none'>
                {getWelcomeMessage(contentType, isPageInjectable)}
              </p>
            </div>
  
            {/* SECTION 3: Content Type / Extraction Info Section */}
            <div className='flex flex-col items-center py-3 w-full'>
              {isPageInjectable ? (
                <>
                  <div
                    className='flex items-center gap-1 text-xs text-theme-secondary cursor-default select-none'
                    ref={includeToggleRef}
                    onMouseEnter={() => setIsIncludeTooltipVisible(true)}
                    onMouseLeave={() => setIsIncludeTooltipVisible(false)}
                    onFocus={() => setIsIncludeTooltipVisible(true)}
                    onBlur={() => setIsIncludeTooltipVisible(false)}
                    aria-describedby='include-context-tooltip-sidebar'
                  >
                    <ContentTypeIcon
                      contentType={contentType}
                      className='w-6 h-6 text-current'
                    />
                    <span className='text-base font-medium ml-2 select-none'>
                      {CONTENT_TYPE_LABELS[contentType] || 'Content'}
                    </span>
                    <Toggle
                      id='content-extract-toggle'
                      checked={isContentExtractionEnabled}
                      onChange={(newCheckedState) => {
                        if (hasAnyPlatformCredentials)
                          setIsContentExtractionEnabled(newCheckedState);
                      }}
                      disabled={!hasAnyPlatformCredentials}
                      className='w-10 h-5 ml-3'
                    />
                  </div>
                  {/* Render Tooltip */}
                  <Tooltip
                    show={isIncludeTooltipVisible}
                    targetRef={includeToggleRef}
                    message='Send content along with your prompt.'
                    position='top'
                    id='include-context-tooltip-sidebar'
                  />
                </>
              ) : (
                <div className='mb-2'>
                  <span className='text-xs text-theme-secondary select-none'>
                    This page content cannot be extracted.
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }
      return null;
    };
  
    // --- Main Component Render ---
    return (
      <div className={`flex-1 flex flex-col relative ${className}`}>
        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className='flex-1 overflow-y-auto flex flex-col @container'
          style={{ scrollbarGutter: 'stable' }}
        >
          {/* Conditional Content Inside Scrollable Container */}
          {messages.length === 0 ? (
            renderInitialView()
          ) : (
            <>
              {/* Render Messages */}
              {messages.map((message, index) => {
                const isLastMessageMap = index === messages.length - 1;
                const isSecondLastMessageMap = index === messages.length - 2;
  
                const isTargetScenarioForHeight =
                  isLastMessageMap &&
                  index > 0 &&
                  (message.role === MESSAGE_ROLES.ASSISTANT ||
                    message.role === MESSAGE_ROLES.SYSTEM) &&
                  messages[index - 1].role === MESSAGE_ROLES.USER;
  
                const isTargetScenarioForRef =
                  isSecondLastMessageMap &&
                  messages.length >= 2 &&
                  (messages[messages.length - 1].role ===
                    MESSAGE_ROLES.ASSISTANT ||
                    messages[messages.length - 1].role ===
                      MESSAGE_ROLES.SYSTEM) &&
                  message.role === MESSAGE_ROLES.USER;
  
                let dynamicStyle = {};
                let messageRef = null;
  
                if (isTargetScenarioForRef) {
                  messageRef = precedingUserMessageRef;
                }
  
                if (isTargetScenarioForHeight && precedingUserMessageHeight > 0) {
                  const viewportHeight = window.innerHeight;
                  const offset = otherUIHeight + precedingUserMessageHeight;
                  const calculatedHeight =
                    viewportHeight - Math.max(0, offset) + 1;
  
                  let rootFontSize = 16;
                  try {
                    rootFontSize = parseFloat(
                      getComputedStyle(document.documentElement).fontSize
                    );
                    if (isNaN(rootFontSize) || rootFontSize <= 0) {
                      logger.sidebar.warn(
                        `Could not parse root font size, falling back to 16px. Value was: ${getComputedStyle(document.documentElement).fontSize}`
                      );
                      rootFontSize = 16;
                    }
                  } catch (e) {
                    logger.sidebar.error('Error getting root font size:', e);
                    rootFontSize = 16;
                  }
                  const minPixelHeight =
                    MIN_ASSISTANT_BUBBLE_HEIGHT_REM * rootFontSize;
  
                  const finalMinHeight = Math.max(
                    minPixelHeight,
                    calculatedHeight
                  );
                  dynamicStyle = {
                    minHeight: `${finalMinHeight}px`,
                  };
                }
  
                return (
                  <MessageBubble
                    ref={messageRef}
                    key={message.id}
                    id={message.id}
                    content={message.content}
                    role={message.role}
                    isStreaming={message.isStreaming}
                    model={message.model}
                    platformIconUrl={message.platformIconUrl}
                    platformId={message.platformId}
                    style={dynamicStyle}
                  />
                );
              })}
  
              {/* Scroll Anchor */}
              <div
                ref={messagesEndRef}
                style={{ height: '1px' }}
                aria-hidden='true'
              />
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
          aria-label='Scroll to bottom'
          title='Scroll to bottom'
          aria-hidden={!showScrollDownButton}
          tabIndex={showScrollDownButton ? 0 : -1}
        >
          <ScrollDownIcon />
        </button>
      </div>
    );
  }
  
  ChatArea.propTypes = {
    className: PropTypes.string,
    otherUIHeight: PropTypes.number,
    requestHeightRecalculation: PropTypes.func,
  };
  
  export default ChatArea;
