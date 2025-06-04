// src/sidepanel/components/ChatArea.jsx ---
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import PropTypes from 'prop-types';

import { formatTokenCount } from '../../shared/utils/number-format-utils';
import { debounce } from '../../shared/utils/debounce-utils';
import { useSidePanelChat } from '../contexts/SidePanelChatContext';
import { useSidePanelPlatform } from '../../contexts/platform';
import { useUI } from '../../contexts/UIContext';
import { Tooltip } from '../../components';
import { PlatformIcon } from '../../components/layout/PlatformIcon';
import { useContent } from '../../contexts/ContentContext';
import {
  CONTENT_TYPES,
} from '../../shared/constants';
import { isInjectablePage } from '../../shared/utils/content-utils';
import { logger } from '../../shared/logger';
import {
  InputTokenIcon,
  OutputTokenIcon,
  ContextWindowIcon,
  FreeTierIcon,
  ScrollDownIcon,
  NoCredentialsIcon,
} from '../../components'; // Removed ExtractionStrategySelector, ContentTypeIcon, Toggle from here
import { MESSAGE_ROLES } // Added MESSAGE_ROLES import
from '../../shared/constants';

import { MessageBubble } from './messaging/MessageBubble';


// --- Constants ---
const MIN_ASSISTANT_BUBBLE_HEIGHT_REM = 2; // Equivalent to 2rem minimum height

function ChatArea({
  className = '',
  otherUIHeight = 160, // Default value, will be updated by SidePanelApp
  requestHeightRecalculation, // Prop to trigger height update in parent
}) {
  const {
    messages,
    // isContentExtractionEnabled, // No longer used directly here
    // setIsContentExtractionEnabled, // No longer used directly here
    modelConfigData,
    isThinkingModeEnabled,
  } = useSidePanelChat();
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
  } = useSidePanelPlatform();

  // --- State ---
  // const [isIncludeTooltipVisible, setIsIncludeTooltipVisible] = useState(false); // Removed
  const [showScrollDownButton, setShowScrollDownButton] = useState(false);
  const [displayPlatformConfig, setDisplayPlatformConfig] = useState(null);
  const [displayModelConfig, setDisplayModelConfig] = useState(null);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);

  const initialViewContainerRef = useRef(null);

  const dynamicSpecs = useMemo(() => {
    if (!displayModelConfig) {
      return {
        contextWindow: null,
        inputPrice: undefined,
        outputPrice: undefined,
      };
    }
    const baseContextWindow = displayModelConfig.tokens?.contextWindow;
    const baseInputPrice = displayModelConfig.pricing?.inputTokenPrice;
    const baseOutputPrice = displayModelConfig.pricing?.outputTokenPrice;
    let contextWindow = baseContextWindow;
    let inputPrice = baseInputPrice;
    let outputPrice = baseOutputPrice;
    if (isThinkingModeEnabled && displayModelConfig.thinking?.toggleable) {
      contextWindow =
        displayModelConfig.thinking.contextWindow ?? contextWindow;
      inputPrice =
        displayModelConfig.thinking.pricing?.inputTokenPrice ?? inputPrice;
      outputPrice =
        displayModelConfig.thinking.pricing?.outputTokenPrice ?? outputPrice;
    }
    return { contextWindow, inputPrice, outputPrice };
  }, [displayModelConfig, isThinkingModeEnabled]);

  const [precedingUserMessageHeight, setPrecedingUserMessageHeight] =
    useState(0);
  const precedingUserMessageRef = useRef(null);
  const [
    initialScrollCompletedForResponse,
    setInitialScrollCompletedForResponse,
  ] = useState(true);
  const rafIdHeightCalc = useRef(null); // Used for user message height calc
  const showButtonTimerRef = useRef(null);
  // const includeToggleRef = useRef(null); // Removed

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
  ]); // Removed hasAnyPlatformCredentials as it's for initial view

  function getWelcomeMessage(contentType, isPageInjectableParam) {
    if (!isPageInjectableParam) {
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

  const SCROLL_THRESHOLD = 10;
  const DEBOUNCE_DELAY = 100;

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
      if (!showScrollDownButton && !showButtonTimerRef.current) {
        showButtonTimerRef.current = setTimeout(() => {
          setShowScrollDownButton(true);
          showButtonTimerRef.current = null;
        }, 500);
      }
    } else {
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

  const lastMessage = messages[messages.length - 1];
  const secondLastMessage =
    messages.length > 1 ? messages[messages.length - 2] : null;

  useLayoutEffect(() => {
    if (messages.length === 0 || !scrollContainerRef.current) {
      if (showScrollDownButton) setShowScrollDownButton(false);
      return;
    }
    const assistantJustFinished =
      lastMessage &&
      (lastMessage.role === MESSAGE_ROLES.ASSISTANT ||
        lastMessage.role === MESSAGE_ROLES.SYSTEM) &&
      !lastMessage.isStreaming;
    if (assistantJustFinished && initialScrollCompletedForResponse) {
      setInitialScrollCompletedForResponse(false);
    }
    if (
      lastMessage &&
      lastMessage.role === MESSAGE_ROLES.USER &&
      initialScrollCompletedForResponse
    ) {
      setInitialScrollCompletedForResponse(false);
    }
    const assistantJustStarted =
      secondLastMessage &&
      secondLastMessage.role === MESSAGE_ROLES.USER &&
      lastMessage &&
      (lastMessage.role === MESSAGE_ROLES.ASSISTANT ||
        lastMessage.role === MESSAGE_ROLES.SYSTEM) &&
      lastMessage.isStreaming === true;
    if (assistantJustStarted && !initialScrollCompletedForResponse) {
      const userMessageElementId = secondLastMessage?.id;
      if (userMessageElementId) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const currentContainer = scrollContainerRef.current;
            const currentElement =
              document.getElementById(userMessageElementId);
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
              setInitialScrollCompletedForResponse(true);
            } else {
              logger.sidepanel.warn(
                `[ChatArea Scrolling Effect] Element or container not found inside *nested* rAF for ID ${userMessageElementId}.`
              );
              setInitialScrollCompletedForResponse(true);
            }
          });
        });
      } else {
        logger.sidepanel.warn(
          `[ChatArea Scrolling Effect] User message element ID not found. Skipping initial scroll.`
        );
        setInitialScrollCompletedForResponse(true);
      }
    }
    checkScrollPosition();
  }, [
    messages.length,
    lastMessage?.id,
    lastMessage?.role,
    lastMessage?.isStreaming,
    secondLastMessage?.id,
    secondLastMessage?.role,
    textSize,
    checkScrollPosition,
    initialScrollCompletedForResponse,
    showScrollDownButton,
    lastMessage,
    secondLastMessage,
  ]);

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
          if (typeof requestHeightRecalculation === 'function') {
            requestHeightRecalculation();
          }
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
  }, [
    messages,
    precedingUserMessageHeight,
    textSize,
    requestHeightRecalculation,
  ]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: behavior,
      });
    }
  }, []);

  const debouncedCheckScrollPosition = useMemo(
    () => debounce(checkScrollPosition, DEBOUNCE_DELAY),
    [checkScrollPosition]
  );

  useEffect(() => {
    return () => {
      if (showButtonTimerRef.current) {
        clearTimeout(showButtonTimerRef.current);
      }
    };
  }, []);

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

  const openApiSettings = () => {
    try {
      if (chrome && chrome.tabs && chrome.runtime) {
        chrome.tabs.create({
          url: chrome.runtime.getURL('settings.html#api-settings'),
        });
      } else {
        logger.sidepanel.warn(
          'Chrome APIs not available. Cannot open settings tab.'
        );
      }
    } catch (error) {
      logger.sidepanel.error('Could not open API options page:', error);
    }
  };

  const isPageInjectableValue = currentTab?.url
    ? isInjectablePage(currentTab.url)
    : false;

  const renderInitialView = () => {
    if (!hasAnyPlatformCredentials) {
      return (
        <div
          className={`flex flex-col items-center justify-center h-full text-theme-secondary text-center px-5 ${className}`}
        >
          <button
            onClick={openApiSettings}
            className='flex flex-col items-center justify-center p-4 rounded-lg hover:bg-theme-hover transition-colors w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-dark'
            aria-label='Configure API Credentials in Settings'
          >
            <NoCredentialsIcon className='w-8 h-8 mb-3 text-theme-secondary select-none' />
            <h3 className='text-base font-semibold mb-2'>
              API Credentials Required
            </h3>
            <p className='text-sm'>
              Click here to configure API keys in the settings.
            </p>
          </button>
        </div>
      );
    }
    if (hasAnyPlatformCredentials && !hasCompletedInitialLoad) {
      return (
        <div className={`flex items-center justify-center h-full ${className}`}>
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
          ref={initialViewContainerRef}
          className={`flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5 py-3 overflow-y-auto ${className}`}
        >
          <div className='flex flex-col items-center py-3 w-full'>
            {displayPlatformConfig ? (
              <div className='select-none'>
                <PlatformIcon
                  platformId={displayPlatformConfig.id}
                  iconUrl={displayPlatformConfig.iconUrl}
                  altText={`${displayPlatformConfig.name || 'Platform'} logo`}
                  className='w-10 h-10 mb-2 object-contain'
                />
              </div>
            ) : (
              <div className='w-10 h-10 mb-2 text-theme-secondary rounded-full animate-pulse select-none'></div>
            )}
            {modelReady ? (
              <>
                <div
                  className='text-base text-theme-primary font-medium'
                  title={displayModelConfig.id}
                >
                  {displayModelConfig.displayName ||
                    displayModelConfig.name ||
                    displayModelConfig.id}
                  {isThinkingModeEnabled &&
                  displayModelConfig.thinking?.toggleable
                    ? ' (Thinking)'
                    : ''}
                </div>
                {displayModelConfig.description && (
                  <p className='text-sm text-theme-secondary text-center mt-1 mb-2 max-w-xs mx-auto'>
                    {displayModelConfig.description}
                  </p>
                )}
                <div className='flex flex-row flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-theme-secondary mt-1'>
                  {dynamicSpecs.inputPrice === 0 &&
                  dynamicSpecs.outputPrice === 0 ? (
                    <div
                      ref={freeTierRef}
                      className='flex items-center relative cursor-help'
                      onMouseEnter={() => setHoveredElement('freeTier')}
                      onMouseLeave={() => setHoveredElement(null)}
                      onFocus={() => setHoveredElement('freeTier')}
                      onBlur={() => setHoveredElement(null)}
                      tabIndex={0}
                      role="button"
                      aria-describedby="chat-area-free-tier-tooltip"
                    >
                      <FreeTierIcon className='w-3.5 h-3.5 mr-1 select-none'/> <span>Free</span>
                      <Tooltip
                        show={hoveredElement === 'freeTier'}
                        message='This model is currently free to use via API.'
                        targetRef={freeTierRef}
                        position='bottom'
                        id="chat-area-free-tier-tooltip"
                      />
                    </div>
                  ) : (
                    <>
                      {typeof dynamicSpecs.inputPrice === 'number' &&
                        dynamicSpecs.inputPrice >= 0 && (
                          <div
                            ref={inputPriceRef}
                            className='flex items-center relative cursor-help'
                            onMouseEnter={() => setHoveredElement('inputPrice')}
                            onMouseLeave={() => setHoveredElement(null)}
                            onFocus={() => setHoveredElement('inputPrice')}
                            onBlur={() => setHoveredElement(null)}
                            tabIndex={0}
                            role="button"
                            aria-describedby="chat-area-input-price-tooltip"
                          >
                            <InputTokenIcon className='w-3.5 h-3.5 mr-1 select-none'/>
                            <span>{`$${dynamicSpecs.inputPrice.toFixed(2)}`}</span>
                            <Tooltip
                              show={hoveredElement === 'inputPrice'}
                              message={`$${dynamicSpecs.inputPrice.toFixed(2)} / 1M input tokens.${isThinkingModeEnabled && displayModelConfig?.thinking?.toggleable ? ' (Thinking Mode)' : ''}`}
                              targetRef={inputPriceRef}
                              position='bottom'
                              id="chat-area-input-price-tooltip"
                            />
                          </div>
                        )}
                      {typeof dynamicSpecs.outputPrice === 'number' &&
                        dynamicSpecs.outputPrice > 0 && (
                          <div
                            ref={outputPriceRef}
                            className='flex items-center relative cursor-help'
                            onMouseEnter={() =>
                              setHoveredElement('outputPrice')
                            }
                            onMouseLeave={() => setHoveredElement(null)}
                            onFocus={() => setHoveredElement('outputPrice')}
                            onBlur={() => setHoveredElement(null)}
                            tabIndex={0}
                            role="button"
                            aria-describedby="chat-area-output-price-tooltip"
                          >
                            <OutputTokenIcon className='w-3.5 h-3.5 mr-1 select-none'/>
                            <span>{`$${dynamicSpecs.outputPrice.toFixed(2)}`}</span>
                            <Tooltip
                              show={hoveredElement === 'outputPrice'}
                              message={`$${dynamicSpecs.outputPrice.toFixed(2)} / 1M output tokens.${isThinkingModeEnabled && displayModelConfig?.thinking?.toggleable ? ' (Thinking Mode)' : ''}`}
                              targetRef={outputPriceRef}
                              position='bottom'
                              id="chat-area-output-price-tooltip"
                            />
                          </div>
                        )}
                    </>
                  )}
                  {typeof dynamicSpecs.contextWindow === 'number' &&
                    dynamicSpecs.contextWindow > 0 && (
                      <div
                        ref={contextWindowRef}
                        className='flex items-center relative cursor-help'
                        onMouseEnter={() => setHoveredElement('contextWindow')}
                        onMouseLeave={() => setHoveredElement(null)}
                        onFocus={() => setHoveredElement('contextWindow')}
                        onBlur={() => setHoveredElement(null)}
                        tabIndex={0}
                        role="button"
                        aria-describedby="chat-area-context-window-tooltip"
                      >
                        <ContextWindowIcon className='w-3 h-3 mr-2 select-none'/>
                        <span>
                          {formatTokenCount(dynamicSpecs.contextWindow)}
                        </span>
                        <Tooltip
                          show={hoveredElement === 'contextWindow'}
                          message={`Max context window: ${formatTokenCount(dynamicSpecs.contextWindow)} tokens.${isThinkingModeEnabled && displayModelConfig?.thinking?.toggleable ? ' (Thinking Mode)' : ''}`}
                          targetRef={contextWindowRef}
                          position='bottom'
                          id="chat-area-context-window-tooltip"
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
          <div className='flex flex-col items-center py-3 w-full'>
            <h3 className='text-base text-theme-primary font-semibold mb-2'>
              Start a conversation
            </h3>
            <p className='text-sm text-theme-secondary max-w-xs mx-auto'>
              {getWelcomeMessage(contentType, isPageInjectableValue)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`flex-1 flex flex-col relative ${className}`}>
      <div
        ref={scrollContainerRef}
        className='flex-1 overflow-y-auto flex flex-col @container'
        style={{ scrollbarGutter: 'stable' }}
      >
        {messages.length === 0 ? (
          renderInitialView()
        ) : (
          <>
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
                    logger.sidepanel.warn(
                      `Could not parse root font size, falling back to 16px. Value was: ${getComputedStyle(document.documentElement).fontSize}`
                    );
                    rootFontSize = 16;
                  }
                } catch (e) {
                  logger.sidepanel.error('Error getting root font size:', e);
                  rootFontSize = 16;
                }
                const minPixelHeight =
                  MIN_ASSISTANT_BUBBLE_HEIGHT_REM * rootFontSize;
                const finalMinHeight = Math.max(
                  minPixelHeight,
                  calculatedHeight
                );
                dynamicStyle = { minHeight: `${finalMinHeight}px` };
              }
              return (
                <MessageBubble
                  ref={messageRef}
                  key={message.id}
                  id={message.id}
                  content={message.content}
                  thinkingContent={message.thinkingContent}
                  role={message.role}
                  isStreaming={message.isStreaming}
                  modelId={message.modelId}
                  platformId={message.platformId}
                  style={dynamicStyle}
                  apiCost={message.apiCost}
                  contextTypeUsed={message.contextTypeUsed}
                  pageContextUsed={message.pageContextUsed}
                />
              );
            })}
            <div
              ref={messagesEndRef}
              style={{ height: '1px' }}
              aria-hidden='true'
            />
          </>
        )}
      </div>
      <button
        onClick={() => scrollToBottom('smooth')}
        className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 z-10 p-1 rounded-full text-theme-primary dark:text-theme-primary-dark transition-opacity duration-300 ease-in-out ${
          showScrollDownButton
            ? 'opacity-100 bg-theme-primary/50'
            : 'opacity-0 pointer-events-none'
        }`}
        aria-label='Scroll to bottom'
        title='Scroll to bottom'
        aria-hidden={!showScrollDownButton}
        tabIndex={showScrollDownButton ? 0 : -1}
      >
        <ScrollDownIcon className='w-6 h-6 select-none' />
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
