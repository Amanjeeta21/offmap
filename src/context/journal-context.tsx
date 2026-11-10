import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "@offmap/travel-journals";

export type Priority = "High" | "Medium" | "Low";

export type JournalActivity = {
  id: string;
  time: string;
  title: string;
  location: string;
  duration: string;
  priority: Priority;
  completed: boolean;
  notes: string;
};

export type JournalDay = {
  id: string;
  date: string;
  title: string;
  notes: string;
  activities: JournalActivity[];
};

export type TravelJournal = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImage: string;
  isSample: boolean;
  createdAt: string;
  days: JournalDay[];
};

type NewJournal = {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImage: string;
};

type JournalContextType = {
  journals: TravelJournal[];
  isLoading: boolean;
  addJournal: (journal: NewJournal) => void;
  updateJournal: (
    id: string,
    changes: Partial<Omit<TravelJournal, "id" | "createdAt">>,
  ) => void;
  deleteJournal: (id: string) => void;
  getJournal: (id: string) => TravelJournal | undefined;
  updateActivity: (
    journalId: string,
    dayId: string,
    activityId: string,
    changes: Partial<JournalActivity>,
  ) => void;
  addActivity: (
    journalId: string,
    dayId: string,
    activity: Omit<JournalActivity, "id">,
  ) => void;
  updateDayNotes: (journalId: string, dayId: string, notes: string) => void;
};

const SAMPLE_JOURNAL: TravelJournal = {
  id: "varanasi-sample",
  title: "Varanasi Diaries",
  destination: "Varanasi, Uttar Pradesh, India",
  startDate: "2026-12-12",
  endDate: "2026-12-14",
  description:
    "Three days of ghats, temples, food and the timeless spirit of Varanasi.",
  coverImage:
    "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=1200",
  isSample: true,
  createdAt: "2026-11-09T00:00:00.000Z",
  days: [
    {
      id: "varanasi-day-1",
      date: "2026-12-12",
      title: "The City Awakens",
      notes:
        "Start early. Take in the river, walk slowly through the old lanes and leave some time to simply observe the city.",
      activities: [
        {
          id: "v1-1",
          time: "5:30 AM",
          title: "Sunrise boat ride on the Ganga",
          location: "Assi Ghat",
          duration: "1 hour",
          priority: "High",
          completed: false,
          notes: "Watch the ghats come alive as the sun rises.",
        },
        {
          id: "v1-2",
          time: "7:00 AM",
          title: "Walk along the ghats",
          location: "Assi Ghat to Dashashwamedh Ghat",
          duration: "1 hour 30 min",
          priority: "High",
          completed: false,
          notes: "Take photographs and explore at a relaxed pace.",
        },
        {
          id: "v1-3",
          time: "9:00 AM",
          title: "Breakfast and local chai",
          location: "Around Godowlia",
          duration: "1 hour",
          priority: "Medium",
          completed: false,
          notes: "Try local kachori sabzi and a cup of chai.",
        },
        {
          id: "v1-4",
          time: "11:00 AM",
          title: "Explore the old city lanes",
          location: "Vishwanath Gali",
          duration: "1 hour 30 min",
          priority: "Medium",
          completed: false,
          notes: "Browse the small shops and discover the narrow lanes.",
        },
        {
          id: "v1-5",
          time: "5:30 PM",
          title: "Evening Ganga Aarti",
          location: "Dashashwamedh Ghat",
          duration: "1 hour",
          priority: "High",
          completed: false,
          notes: "Arrive early to find a comfortable viewing spot.",
        },
      ],
    },
    {
      id: "varanasi-day-2",
      date: "2026-12-13",
      title: "Temples and Traditions",
      notes:
        "Keep the morning flexible for temple visits. Dress comfortably and allow extra time for queues.",
      activities: [
        {
          id: "v2-1",
          time: "6:30 AM",
          title: "Visit Kashi Vishwanath Temple",
          location: "Kashi Vishwanath Corridor",
          duration: "2 hours",
          priority: "High",
          completed: false,
          notes:
            "Check the current visitor and entry guidelines before visiting.",
        },
        {
          id: "v2-2",
          time: "9:30 AM",
          title: "Breakfast in the old city",
          location: "Godowlia",
          duration: "1 hour",
          priority: "Medium",
          completed: false,
          notes: "Take a break and try another local breakfast spot.",
        },
        {
          id: "v2-3",
          time: "11:00 AM",
          title: "Visit Bharat Mata Temple",
          location: "Bharat Mata Mandir",
          duration: "1 hour",
          priority: "Medium",
          completed: false,
          notes: "Explore the unusual marble relief map of India.",
        },
        {
          id: "v2-4",
          time: "1:00 PM",
          title: "Lunch and rest",
          location: "Near your stay",
          duration: "2 hours",
          priority: "Low",
          completed: false,
          notes: "Keep the afternoon relaxed.",
        },
        {
          id: "v2-5",
          time: "4:30 PM",
          title: "Explore more riverfront ghats",
          location: "Manikarnika and nearby ghats",
          duration: "1 hour 30 min",
          priority: "Medium",
          completed: false,
          notes: "Be respectful of local customs and ceremonies.",
        },
      ],
    },
    {
      id: "varanasi-day-3",
      date: "2026-12-14",
      title: "A Slow Goodbye",
      notes:
        "Keep the final day unhurried. Pick up souvenirs and enjoy one last walk by the river.",
      activities: [
        {
          id: "v3-1",
          time: "7:00 AM",
          title: "Quiet morning by the Ganga",
          location: "Assi Ghat",
          duration: "1 hour",
          priority: "High",
          completed: false,
          notes: "Enjoy the river without rushing to the next stop.",
        },
        {
          id: "v3-2",
          time: "9:00 AM",
          title: "Breakfast and Banarasi treats",
          location: "Lanka",
          duration: "1 hour",
          priority: "Medium",
          completed: false,
          notes: "Try local sweets and snacks.",
        },
        {
          id: "v3-3",
          time: "10:30 AM",
          title: "Souvenir shopping",
          location: "Thatheri Bazaar",
          duration: "1 hour 30 min",
          priority: "Medium",
          completed: false,
          notes: "Look for Banarasi silk and local handicrafts.",
        },
        {
          id: "v3-4",
          time: "12:30 PM",
          title: "Final lunch in Varanasi",
          location: "Old city",
          duration: "1 hour",
          priority: "Low",
          completed: false,
          notes: "Save a little time to write down your favourite memories.",
        },
      ],
    },
  ],
};

// Generate one empty itinerary day for every date in the trip.
function createJournalDays(startDate: string, endDate: string): JournalDay[] {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return [];
  }

  const days: JournalDay[] = [];

  for (
    let current = new Date(start), index = 0;
    current <= end;
    current.setUTCDate(current.getUTCDate() + 1), index++
  ) {
    days.push({
      id: `day-${Date.now()}-${index}`,
      date: current.toISOString().split("T")[0],
      title: `Day ${index + 1}`,
      notes: "",
      activities: [],
    });
  }

  return days;
}

// Repair older saved journals that do not have itinerary days.
function migrateJournal(journal: TravelJournal): TravelJournal {
  return {
    ...journal,
    days:
      Array.isArray(journal.days) && journal.days.length > 0
        ? journal.days
        : createJournalDays(journal.startDate, journal.endDate),
  };
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

type JournalProviderProps = {
  children: ReactNode;
};

export function JournalProvider({ children }: JournalProviderProps) {
  const [journals, setJournals] = useState<TravelJournal[]>([SAMPLE_JOURNAL]);
  const [isLoading, setIsLoading] = useState(true);

  // Load and migrate saved journals when the app starts.
  useEffect(() => {
    async function loadJournals() {
      try {
        const savedData = await AsyncStorage.getItem(STORAGE_KEY);

        if (savedData) {
          const savedJournals: TravelJournal[] = JSON.parse(savedData);

          // IMPORTANT: Actually use the migrated journals here.
          const migratedJournals = savedJournals.map(migrateJournal);

          const hasSample = migratedJournals.some(
            (journal) => journal.id === SAMPLE_JOURNAL.id,
          );

          setJournals(
            hasSample
              ? migratedJournals
              : [SAMPLE_JOURNAL, ...migratedJournals],
          );
        } else {
          setJournals([SAMPLE_JOURNAL]);
        }
      } catch (error) {
        console.error("Could not load journals:", error);
        setJournals([SAMPLE_JOURNAL]);
      } finally {
        setIsLoading(false);
      }
    }

    loadJournals();
  }, []);

  // Save journal changes after initial loading.
  useEffect(() => {
    if (isLoading) return;

    async function saveJournals() {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(journals));
      } catch (error) {
        console.error("Could not save journals:", error);
      }
    }

    saveJournals();
  }, [journals, isLoading]);

  // Create a journal with automatically generated itinerary days.
  function addJournal(journal: NewJournal) {
    const newJournal: TravelJournal = {
      ...journal,
      id: `journal-${Date.now()}`,
      isSample: false,
      createdAt: new Date().toISOString(),
      days: createJournalDays(journal.startDate, journal.endDate),
    };

    setJournals((current) => [...current, newJournal]);
  }

  function updateJournal(
    id: string,
    changes: Partial<Omit<TravelJournal, "id" | "createdAt">>,
  ) {
    setJournals((current) =>
      current.map((journal) =>
        journal.id === id ? { ...journal, ...changes } : journal,
      ),
    );
  }

  function deleteJournal(id: string) {
    setJournals((current) => current.filter((journal) => journal.id !== id));
  }

  function getJournal(id: string) {
    return journals.find((journal) => journal.id === id);
  }

  // Update an existing activity.
  function updateActivity(
    journalId: string,
    dayId: string,
    activityId: string,
    changes: Partial<JournalActivity>,
  ) {
    setJournals((current) =>
      current.map((journal) => {
        if (journal.id !== journalId) return journal;

        return {
          ...journal,
          days: journal.days.map((day) => {
            if (day.id !== dayId) return day;

            return {
              ...day,
              activities: day.activities.map((activity) =>
                activity.id === activityId
                  ? { ...activity, ...changes }
                  : activity,
              ),
            };
          }),
        };
      }),
    );
  }

  // Add a new activity to a particular day.
  function addActivity(
    journalId: string,
    dayId: string,
    activity: Omit<JournalActivity, "id">,
  ) {
    setJournals((current) =>
      current.map((journal) => {
        if (journal.id !== journalId) return journal;

        return {
          ...journal,
          days: journal.days.map((day) =>
            day.id === dayId
              ? {
                  ...day,
                  activities: [
                    ...day.activities,
                    {
                      ...activity,
                      id: `activity-${Date.now()}`,
                    },
                  ],
                }
              : day,
          ),
        };
      }),
    );
  }

  // Update notes for a particular day.
  function updateDayNotes(journalId: string, dayId: string, notes: string) {
    setJournals((current) =>
      current.map((journal) => {
        if (journal.id !== journalId) return journal;

        return {
          ...journal,
          days: journal.days.map((day) =>
            day.id === dayId ? { ...day, notes } : day,
          ),
        };
      }),
    );
  }

  const value = useMemo(
    () => ({
      journals,
      isLoading,
      addJournal,
      updateJournal,
      deleteJournal,
      getJournal,
      updateActivity,
      addActivity,
      updateDayNotes,
    }),
    [journals, isLoading],
  );

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
}

export function useJournals() {
  const context = useContext(JournalContext);

  if (!context) {
    throw new Error("useJournals must be used inside a JournalProvider");
  }

  return context;
}
