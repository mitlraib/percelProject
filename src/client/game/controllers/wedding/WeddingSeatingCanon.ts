// src/client/game/controllers/wedding/WeddingSeatingCanon.ts

export type GuestGroup = "family" | "friends" | "other";

export type GuestDef = {
  id: string;
  label: string;
  group: GuestGroup;
};

export type ConflictRule = {
  type: "notTogether";
  a: string;
  b: string;
  reason: string;
};

export type TogetherRule = {
  type: "mustTogether";
  a: string;
  b: string;
  reason: string;
};

export type GroupRule = {
  type: "groupTogether";
  group: GuestGroup;
  minPerTable: number;
  reason: string;
};

export type SeatingRule = ConflictRule | TogetherRule | GroupRule;

export type TableState = {
  tableId: number;
  seatGuestIds: Array<string | null>;
};

export type SeatingValidationResult = {
  ok: boolean;
  message: string;
};

export default class WeddingSeatingCanon {
  readonly guests: GuestDef[];
  readonly rules: SeatingRule[];
  readonly tablesCount: number;
  readonly seatsPerTable: number;

  constructor() {
    this.tablesCount = 2;
    this.seatsPerTable = 3;

    this.guests = [
      { id: "aunt-rachel", label: "דודה רחל", group: "family" },
      { id: "uncle-moshe", label: "דוד משה", group: "family" },
      { id: "cousin-dana", label: "בת דודה דנה", group: "family" },
      { id: "yossi", label: "יוסי", group: "friends" },
      { id: "noa", label: "נועה", group: "friends" },
      { id: "omer", label: "עומר", group: "friends" },
    ];

    this.rules = [
      {
        type: "notTogether",
        a: "aunt-rachel",
        b: "uncle-moshe",
        reason: "דודה רחל ודוד משה לא יכולים לשבת באותו שולחן",
      },
      {
        type: "mustTogether",
        a: "yossi",
        b: "noa",
        reason: "יוסי ונועה חייבים לשבת יחד",
      },
      {
        type: "groupTogether",
        group: "family",
        minPerTable: 2,
        reason: "בני משפחה צריכים לשבת לפחות בזוגות",
      },
      {
        type: "groupTogether",
        group: "friends",
        minPerTable: 2,
        reason: "חברים צריכים לשבת לפחות בזוגות",
      },
    ];
  }

  getGuestById(id: string): GuestDef | undefined {
    return this.guests.find((g) => g.id === id);
  }

  createEmptyTables(): TableState[] {
    return Array.from({ length: this.tablesCount }, (_, i) => ({
      tableId: i,
      seatGuestIds: Array.from({ length: this.seatsPerTable }, () => null),
    }));
  }

  validate(tables: TableState[]): SeatingValidationResult {
    const placedGuestIds = tables.flatMap((t) => t.seatGuestIds).filter(Boolean) as string[];

    if (placedGuestIds.length !== this.guests.length) {
      return {
        ok: false,
        message: "עדיין לא כל האורחים יושבו",
      };
    }

    const unique = new Set(placedGuestIds);
    if (unique.size !== this.guests.length) {
      return {
        ok: false,
        message: "אותו אורח שובץ יותר מפעם אחת",
      };
    }

    for (const rule of this.rules) {
      if (rule.type === "notTogether") {
        for (const table of tables) {
          const hasA = table.seatGuestIds.includes(rule.a);
          const hasB = table.seatGuestIds.includes(rule.b);
          if (hasA && hasB) {
            return {
              ok: false,
              message: rule.reason,
            };
          }
        }
      }

      if (rule.type === "mustTogether") {
        let tableOfA = -1;
        let tableOfB = -1;

        for (const table of tables) {
          if (table.seatGuestIds.includes(rule.a)) tableOfA = table.tableId;
          if (table.seatGuestIds.includes(rule.b)) tableOfB = table.tableId;
        }

        if (tableOfA === -1 || tableOfB === -1 || tableOfA !== tableOfB) {
          return {
            ok: false,
            message: rule.reason,
          };
        }
      }

      if (rule.type === "groupTogether") {
        for (const table of tables) {
          const groupGuests = table.seatGuestIds
            .filter(Boolean)
            .map((id) => this.getGuestById(id as string))
            .filter(Boolean)
            .filter((g) => g!.group === rule.group);

          if (groupGuests.length === 1) {
            return {
              ok: false,
              message: rule.reason,
            };
          }

          if (groupGuests.length > 0 && groupGuests.length < rule.minPerTable) {
            return {
              ok: false,
              message: rule.reason,
            };
          }
        }
      }
    }

    return {
      ok: true,
      message: "מעולה! כולם יושבים בלי ריבים משפחתיים",
    };
  }
}