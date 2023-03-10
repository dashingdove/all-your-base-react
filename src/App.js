import React from 'react';
import './index.css';

function App() {

  const card_suits = ["HEART", "DIA", "CLUB", "SPADE"];
  const card_values = Array.from(Array(13), (v, k) => k+1);
  const all_cards = Array.from(card_suits, (sv, sk) =>
    Array.from(card_values, (vv, vk) =>
      ({suit: sv, value: vv})
    )
  ).flat()
    .concat([{suit: "HEART", value: 0}, {suit: "SPADE", value: 0}])
    .map(card => ({...card, id: getCardID(card)}));

  const player_count = 2;
  const player_card_count_at_start = 7;
  const board_dm = [1, 2, 3, 4, 3, 2, 1];
  const df_board = Array.from(Array(board_dm.length), (v, k) => Array(board_dm[k]));

  const init = {
    current_player: 0,
    cards: all_cards,
    players: Array(player_count).fill().map(x => ({level: 0})),
  };
  const [state, setState] = React.useState(init);
  
  React.useEffect(newGame, []); //starts new game on load

  function updateCard(cards, card) {
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].id === card.id) {
        cards[i] = card;
        break;
      }
    }
    return cards;
  }
  
  function validatePlayerID(playerID) {
    if (playerID >= 0 && playerID < player_count) {
      return;
    }
    if (typeof playerID === 'number') {
      throw new RangeError("Invalid player ID");
    } else {
      throw new TypeError("Invalid player ID");
    }
  }

  function validateCardState(card_state) {
    /* card_state may be undefined or a number within one of the ranges below:
      undefined: the card is still in the deck and can be drawn
      0-1: the card is in the hand of player 0 or 1
      2-8: the card is on the board, at the specified level 0-7
      9-22: the card has been played from a hand at the specified level (9-15 for player 0 and 16-22 for player 1)
    */
    if (typeof card_state === 'undefined') {
      return;
    } else if (typeof card_state === 'number') {
      if (card_state >= 0 && card_state < player_count + (board_dm.length * (player_count + 1))) {
      } else {
        throw new RangeError("Invalid card state: " + card_state);
      }
    } else {
      throw new TypeError("Invalid card state: " + card_state);
    }
  }

  function getHand(playerID, cards) {
    if (typeof cards === 'undefined') {
      cards = state.cards;
    }
    validatePlayerID(playerID);
    return getStateCards(playerID, cards);
  }

  function getAvailableCards(cards) {
    if (typeof cards === 'undefined') {
      cards = state.cards;
    }
    return state.cards.filter(card => card.state === undefined);
  }

  function getPlayerLevel(playerID, offset=0) {
    validatePlayerID(playerID);
    if (playerID === 0) {
      return state.players[0].level + offset;
    } else if (playerID === 1) {
      return (board_dm.length - 1) - state.players[1].level - offset;
    }
  }

  function getBoardCards(cards) {
    if (typeof cards === 'undefined') {
      cards = state.cards;
    }
    let board = [];
    for (let i = 0; i < board_dm.length; i++) {
      board.push(getLevelCards(i, cards));
    }
    return board;
  }

  function getLevelCards(level, cards) {
    if (typeof cards === 'undefined') {
      cards = state.cards;
    }
    return getStateCards(player_count + level, cards).sort((a, b) => a.position - b.position);
  }

  function getStateCards(card_state, cards) {
    if (typeof cards === 'undefined') {
      cards = state.cards;
    }
    return cards.filter(card => card.state === card_state);
  }

  function getPlayedCardState(playerID, level) {
    return player_count + (board_dm.length * (1 + playerID)) + level;
  }

  function newGame() {
    
    //set up board
    let board = df_board;
    let cards = init.cards;
    for (let i = 0; i < board.length; i++) {
      for (let j = 0; j < board[i].length; j++) {
        cards = drawCard(i + player_count, cards);
      }
    }
    board = getBoardCards(cards);
    updateCard(cards, {...board[0][0], open: true});
    updateCard(cards, {...board[board.length - 1][board[0].length - 1], open: true});

    //deal cards to players
    for (let i = 0; i < player_count; i++) {
      for (let j = 0; j < player_card_count_at_start; j++) {
        cards = drawCard(i, cards);
      }
    }
    setState({...init, cards: cards});

  }

  function drawCard(card_state, cards) {
    if (typeof cards === 'undefined') {
      cards = [...state.cards];
    }
    validateCardState(card_state);
    let available_cards = getAvailableCards();
    if (available_cards.length > 0) {
      let card = available_cards[Math.floor(Math.random()*available_cards.length)];
      card.state = card_state;
      card.position = getStateCards(card_state).length;
      updateCard(cards, card);
      return cards;
    }

  }

  function playHand(playerID) {
  
    let new_state = state;
    let cards = [...new_state.cards];

    if (canPlay()) {

      let turn_cards = getHand(playerID).filter(card => card.active);
      let current_level = getPlayerLevel(playerID),
          next_level = getPlayerLevel(playerID, 1);

      //open/close pathways
      
      for (let card of getLevelCards(next_level, cards)) {
        card.open = false;
      }

      for (let card of getLevelCards(current_level, cards)) {

        card.active = false;

        if (handMatches(turn_cards, card)) {

          card.open = true;

          for (let next_card of nextBoardCards(playerID, cards, card)) {
            next_card.open = true;
          }

        } else {
          card.open = false;
        }

      }
     
      //remove cards from hand
      for (let card of turn_cards) {
        card.state = getPlayedCardState(playerID, getPlayerLevel(playerID));
      }

      //move player to next level
      new_state.players[playerID].level++;

      //check opponent's hand still matches
      for (let i = 0; i < state.players.length; i++) {
        if (i !== playerID) {

          for (let level in [next_level, current_level]) {

            let played_cards = getStateCards(getPlayedCardState(i, level), cards);
            if (played_cards.length > 0) {

              let has_match = false;
              for (let card of getLevelCards(level, cards)) {
                if (handMatches(played_cards, card)) {
                  has_match = true;
                  break;
                }
              }

              //if failed to match on new cards, cards are returned and opponent has to replay.
              if (!has_match) {
                for (let card of played_cards) {
                  card.state = i;
                }
                new_state.players[i].level = level;
              }
            }

          }

        }
      }

    }

    setState({...new_state});

    if (new_state.players[playerID].level >= board_dm.length) {
      alert(`Player ${playerID + 1} wins!`);
      newGame();
    }

  }

  function nextTurn(new_state=state) {
    
    let cards = drawCard(new_state.current_player);

    let next_player = new_state.current_player;
    next_player++;
    if (next_player >= player_count) {
      next_player = 0;
    }

    for (let row of getBoardCards(cards)) {
      for (let card of row) {
        card.active = false;
        updateCard(cards, card);
      }
    }

    setState({...new_state, current_player: next_player, cards: cards});

  }

  function getCardID(card) {
    if (card_suits.includes(card.suit) && (card_values.includes(card.value) || card.value === 0)) {
      return card.suit.substr(0, 1) + card.value.toString();
    } else {
      throw new TypeError("Invalid value passed to getCardID; Value: "+JSON.stringify(card));
    }
  }

  function setCardActive(card, active) {
    if (typeof active === 'undefined') {
      active = !card.active;
    }
    let cards = [...state.cards];

    updateCard(cards, {...card, active: active});

    //activate board cards if player hand matches
    if (card.state === state.current_player) {
      for (let board_card of getLevelCards(getPlayerLevel(state.current_player), cards)) {
        updateCard(cards, {...board_card, active: handMatches(getHand(state.current_player, cards), board_card)});
      }
    }

    setState({...state, cards: cards});
  }

  function* cardValueCombinations (values, start) {
    if (typeof start === 'undefined') {
        start = 0;
    }
    values = [...values];
    if (values.length == 0) {
        yield start;
    }
    else if (values.length == 1) {
        yield start + values[0];
        yield start - values[0];
    }
    else {
        let next_value = values.splice(0, 1)[0];
        yield *cardValueCombinations(values, start + next_value);
        yield *cardValueCombinations(values, start - next_value);
    }
  }

  function handMatches (hand, card_to_match) {
    if (card_to_match.open === false) return false;
    let hand_values = hand.filter(card => card.active).map(card => card.value);
    if (card_to_match.value === 0 || hand_values.includes(0)) return true; //joker always matches
    for (let combo of cardValueCombinations(hand_values)) {
      if (combo === card_to_match.value)
        return true;
    }
    return false;
  }

  function canPlay () {
    for (let card of getLevelCards(getPlayerLevel(state.current_player))) {
      if (card.active) {
        return true;
      }
    }
    return false;
  }

  function nextBoardCards(playerID, cards, card) {
    if (!(card.state >= player_count && card.state < player_count + board_dm.length)) {
      throw new RangeError("The card state is not located within the board. Value: " + card.state);
    }
    let result = [];
    
    let board_cards = getBoardCards(cards);
    let card_pos = {};
    for (let i = 0; i < board_cards.length; i++) {
      for (let j = 0; j < board_cards[i].length; j++) {
        if (board_cards[i][j].id === card.id) {
          card_pos = {x:i, y:j};
        }
      }
    }

    if (playerID === 0) {
      if (card_pos === board_cards.length - 1) {
        return [];
      }
      result.push(board_cards[card_pos.x + 1][card_pos.y]);
      if (board_cards[card_pos.x + 1].length > board_cards[card_pos.x].length) {
        result.push(board_cards[card_pos.x + 1][card_pos.y + 1]);
      } else if (board_cards[card_pos.x + 1].length < board_cards[card_pos.x].length) {
        result.push(board_cards[card_pos.x + 1][card_pos.y - 1]);
      }
    } else if (playerID === 1) {
      if (card_pos === 0) {
        return [];
      }
      result.push(board_cards[card_pos.x - 1][card_pos.y]);
      if (board_cards[card_pos.x - 1].length > board_cards[card_pos.x].length) {
        result.push(board_cards[card_pos.x - 1][card_pos.y + 1]);
      } else if (board_cards[card_pos.x - 1].length < board_cards[card_pos.x].length) {
        result.push(board_cards[card_pos.x - 1][card_pos.y - 1]);
      }
    }

    return result.filter(x => typeof x !== 'undefined');

  }

  function switchJoker(card, playerID) {
    
    let cards = [...state.cards];

    //pick up joker from board
    if (card.value === 0) {

      let active_cards = getHand(playerID, cards).filter(card => card.active);
      if (active_cards.length === 0) {
        active_cards = getHand(playerID, cards);
        if (active_cards.length === 0) {
          return;
        }
      }

      active_cards[0].state = card.state;
      card.state = playerID;

    }
    //replace with joker in hand
    else {

      let jokers = getHand(playerID, cards).filter(card => card.value === 0);
      if (jokers.length === 0) {
        return;
      }

      jokers[0].state = card.state;
      card.state = playerID;

    }

    setState({...state, cards: cards});

  }

  return (
    <div>
      <Hand cards={getHand(0)} toggleActive={setCardActive} isPlaying={state.current_player == 0} play={() => playHand(0)} skip={() => nextTurn(state)} canPlay={canPlay()}/>
      <table id="board">
        <tbody>
          {getBoardCards().map((row, i) => <tr key={i} className={`row ${i === getPlayerLevel(state.current_player) ? 'active' : ''}`}>{row.map(card => <Card card={card} show={card.open} onClick={() => switchJoker(card, state.current_player)}/>)}</tr>)}
        </tbody>
      </table>
      <Hand cards={getHand(1)} toggleActive={setCardActive} isPlaying={state.current_player == 1} play={() => playHand(1)} skip={() => nextTurn(state)} canPlay={canPlay()}/>
    </div>
  );

}

function Hand({cards, toggleActive, isPlaying, play, skip, canPlay}) {

  function render_buttons() {
    if (isPlaying) {
      return (
        <div>
          <button type="button" disabled={!canPlay} onClick={play}>Play</button>
          <button type="button" onClick={skip}>Pass</button>
        </div>
      );
    } else {
      return null;
    }
  }

  return (
    <div className={`hand ${isPlaying ? 'playing' : null}`}>
      <table>
        <tbody>
          <tr>
            {cards.map(card => <Card card={card} show={isPlaying} onClick={() => toggleActive(card)}/>)}
          </tr>
        </tbody>
      </table>
      {render_buttons()}
    </div>
  );

}

function Card ({card, show, onClick}) {
  return (
    <td key={card.id} className={`card ${show && card.active ? 'active' : ''}`} onClick={show ? onClick : null}>{show ? card.id : 'X'}</td>
  );
}

export default App;
