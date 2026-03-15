import { useEffect, useRef, useState } from "react";

import { WS_BASE_URL } from "../config";
import { AuctionContext } from "./AuctionContextBase";

export function AuctionProvider({ children, teamId, adminToken }) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const [state, setState] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [timer, setTimer] = useState(0);
  const [socketError, setSocketError] = useState(null);

  useEffect(() => {
    let unmounted = false;
    const tokenQuery = adminToken ? `?token=${encodeURIComponent(adminToken)}` : "";
    const url = `${WS_BASE_URL}/ws/${encodeURIComponent(teamId || "spectator")}${tokenQuery}`;

    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setConnected(true);
        setSocketError(null);
      };
      ws.current.onclose = () => {
        setConnected(false);
        if (!unmounted) {
          reconnectTimer.current = setTimeout(() => connect(), 3000);
        }
      };
      ws.current.onerror = () => {
        setSocketError("WebSocket connection error");
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
          setBidHistory((history) => [
            { team: data.team?.name, amount: data.amount, time: new Date().toLocaleTimeString() },
            ...history.slice(0, 49),
          ]);
        } else if (event === "next_player") {
          setState((prev) =>
            prev ? { ...prev, current_player: data, current_highest_bid: null, current_highest_team: null } : prev
          );
          setBidHistory([]);
        } else if (event === "player_sold") {
          setState((prev) => {
            if (!prev) return prev;
            const teams = prev.teams.map((team) =>
              team.id === data.team.id ? { ...team, budget_remaining: data.team.budget_remaining } : team
            );
            return { ...prev, teams };
          });
        } else if (event === "auction_complete") {
          setState((prev) => (prev ? { ...prev, status: "complete" } : prev));
        } else if (event === "autopilot_changed") {
          setState((prev) => (prev ? { ...prev, autopilot: data.autopilot } : prev));
        } else if (event === "auth_error") {
          setSocketError(data?.error || "Unauthorized admin operation");
        } else if (event === "bid_error") {
          setSocketError(data?.error || "Bid failed");
        }
      };
    };
    connect();
    return () => {
      unmounted = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      ws.current?.close();
    };
  }, [adminToken, teamId]);

  const send = (payload) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
    }
  };

  return (
    <AuctionContext.Provider
      value={{
        state,
        timer,
        bidHistory,
        connected,
        socketError,
        placeBid: (amount) => send({ event: "place_bid", amount }),
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
