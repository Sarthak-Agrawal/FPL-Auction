import { useContext } from "react";

import { AuctionContext } from "./AuctionContextBase";

export function useAuction() {
  return useContext(AuctionContext);
}
