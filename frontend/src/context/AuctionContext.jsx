import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const AuctionContext = createContext(null);

export function AuctionProvider({ children, teamId }) {
  const ws = useRef(null);
  const [state, setState] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [timer, setTimer] = useState(0);

  const connect = useCallback(() => {
    const host = window.location.hostname;
    const url = `ws://${host}:8000/ws/${encodeURIComponent(teamId || "spectator")}`;
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };

    ws.current.onmessage = (e) => {
      const { event, data } = JSON.parse(e.data);

      if (event === "auction_state") {
        setState(data);
        if (data.timer_remaining !== undefined) setTimer(data.timer_remaining);
      } else if (event === "timer_tick") {
        setTimer(data.seconds_remaining);
      } else if (event === "bid_placed") {
        setState((prev) =>
          prev ? { ...prev, current_highest_bid: data.amount, current_highest_team: data.team } : prev
        );
        setBidHistory((h) => [
          { team: data.team?.name, amount: data.amount, time: new Date().toLocaleTimeString() },
          ...h.slice(0, 49),
        ]);
      } else if (event === "next_player") {
        setState((prev) =>
          prev ? { ...prev, current_player: data, current_highest_bid: null, current_highest_team: null } : prev
        );
        setBidHistory([]);
      } else if (event === "player_sold") {
        setState((prev) => {
          if (!prev) return prev;
          const teams = prev.teams.map((t) =>
            t.id === data.team.id ? { ...t, budget_remaining: data.team.budget_remaining } : t
          );
          return { ...prev, teams };
        });
      } else if (event === "auction_complete") {
        setState((prev) => prev ? { ...prev, status: "complete" } : prev);
      } else if (event === "autopilot_changed") {
        setState((prev) => prev ? { ...prev, autopilot: data.autopilot } : prev);
      }
    };
  }, [teamId]);

  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, [connect]);

  const send = useCallback((payload) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
    }
  }, []);

  return (
    <AuctionContext.Provider
      value={{
        state,
        timer,
        bidHistory,
        connected,
        placeBid: (amount) => send({ event: "place_bid", team_id: Number(teamId), amount }),
        adminNext: () => send({ event: "admin_next" }),
        adminSold: () => send({ event: "admin_sold" }),
        adminUnsold: () => send({ event: "admin_unsold" }),
        toggleAutopilot: (enabled) => send({ event: "admin_toggle_autopilot", enabled }),
      }}
    >
      {children}
    </AuctionContext.Provider>
  );
}

export const useAuction = () => useContext(AuctionContext);
