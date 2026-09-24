import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import { I18nProvider } from './i18n/I18nContext';
import { Header, AppMode } from './components/common/Header';
import { LobbyView } from './components/lobby/LobbyView';
import { TabletopView } from './components/tabletop/TabletopView';
import { SoloTabletopView } from './components/tabletop/SoloTabletopView';
import { Scorekeeper } from './components/companion/Scorekeeper';
import { RulesEncyclopedia } from './components/rules/RulesEncyclopedia';
import { useSkruSocket } from './socket/useSkruSocket';

const MainApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>('ONLINE');
  const [myPlayerId] = useState<string>(() => {
    let id = localStorage.getItem('skru_my_player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('skru_my_player_id', id);
    }
    return id;
  });

  const {
    isConnected,
    gameState,
    lobbyState,
    peekReveal,
    chatMessages,
    emojiReactions,
    isJoiningRoom,
    joinError,
    networkDebug,
    send,
    clearPeekReveal,
    leaveRoom,
    addBotToLobby,
    clearJoinError
  } = useSkruSocket();

  // Auto-fill room from URL query ?room=SKRU-XXX
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        // Can be used by lobby
      }
    }
  }, []);

  const handleCreateRoom = (name: string, avatar: string, options: any) => {
    send('CREATE_ROOM', {
      playerId: myPlayerId,
      name,
      avatar,
      options
    });
  };

  const handleJoinRoom = (roomCode: string, name: string, avatar: string, passcode?: string, team?: 'A' | 'B') => {
    send('JOIN_ROOM', {
      roomCode,
      playerId: myPlayerId,
      name,
      avatar,
      passcode,
      team
    });
  };

  const handleStartGame = () => {
    send('START_GAME', {});
  };

  const handleDrawCard = (from: 'DRAW_PILE' | 'DISCARD_PILE') => {
    send('DRAW_CARD', { from });
  };

  const handleSwapCard = (handIndex: number) => {
    send('SWAP_CARD', { handIndex });
  };

  const handleDiscardCard = (triggerAction: boolean = true) => {
    send('DISCARD_CARD', { triggerAction });
  };

  const handleExecuteAction = (payload: any) => {
    send('EXECUTE_ACTION', payload);
  };

  const handleMatchSlap = (handIndex: number) => {
    send('MATCH_SLAP', { handIndex });
  };

  const handleCallSkru = () => {
    send('CALL_SKRU', {});
  };

  const handleStartNextRound = () => {
    send('START_NEXT_ROUND', {});
  };

  const handleSendChat = (text: string) => {
    send('CHAT_MESSAGE', { text });
  };

  const handleSendEmoji = (emoji: string) => {
    send('EMOJI_REACTION', { emoji });
  };

  const handleLeaveRoom = () => {
    leaveRoom();
  };

  return (
    <div className="min-h-screen flex flex-col bg-table">
      {/* Header bar */}
      <Header
        currentMode={currentMode}
        onSelectMode={(mode) => setCurrentMode(mode)}
        roomCode={gameState?.roomCode || lobbyState?.roomCode}
        onLeaveRoom={gameState || lobbyState ? handleLeaveRoom : undefined}
      />

      {/* Main Mode View */}
      <main className="flex-1 flex flex-col">
        {currentMode === 'ONLINE' && (
          <>
            {gameState && gameState.status !== 'LOBBY' ? (
              <TabletopView
                gameState={gameState}
                myPlayerId={myPlayerId}
                peekReveal={peekReveal}
                chatMessages={chatMessages}
                emojiReactions={emojiReactions}
                onDrawCard={handleDrawCard}
                onSwapCard={handleSwapCard}
                onDiscardCard={handleDiscardCard}
                onExecuteAction={handleExecuteAction}
                onMatchSlap={handleMatchSlap}
                onCallSkru={handleCallSkru}
                onStartNextRound={handleStartNextRound}
                onSendChat={handleSendChat}
                onSendEmoji={handleSendEmoji}
              />
            ) : (
              <LobbyView
                lobbyState={lobbyState}
                onJoinRoom={handleJoinRoom}
                onCreateRoom={handleCreateRoom}
                onStartGame={handleStartGame}
                onAddBot={addBotToLobby}
                onLeaveRoom={handleLeaveRoom}
                isConnected={isConnected}
                myPlayerId={myPlayerId}
                isJoiningRoom={isJoiningRoom}
                joinError={joinError}
                onClearJoinError={clearJoinError}
                networkDebug={networkDebug}
              />
            )}
          </>
        )}

        {currentMode === 'SOLO' && (
          <SoloTabletopView />
        )}

        {currentMode === 'SCOREKEEPER' && (
          <Scorekeeper />
        )}

        {currentMode === 'RULES' && (
          <RulesEncyclopedia />
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <MainApp />
      </I18nProvider>
    </ThemeProvider>
  );
}
