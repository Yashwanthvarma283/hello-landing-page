export const VISUALIZER_STORAGE_KEY = 'javaarena:visualizer:payload';

export interface VisualizerPayload {
  code: string;
  title?: string;
  stdin?: string;
}

export const DEFAULT_VISUALIZER_CODE = `public class Main {
    public static void main(String[] args) {
        int[] nums = {5, 2, 9, 1};
        int max = nums[0];
        for (int i = 1; i < nums.length; i++) {
            if (nums[i] > max) {
                max = nums[i];
            }
        }
        System.out.println("Max = " + max);
    }
}`;

/** Store code for the visualizer and return the route to navigate to. */
export const stageVisualizerCode = (payload: VisualizerPayload): string => {
  try {
    sessionStorage.setItem(VISUALIZER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  return '/visualize';
};

export const readStagedVisualizerCode = (): VisualizerPayload | null => {
  try {
    const raw = sessionStorage.getItem(VISUALIZER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.code === 'string') return parsed as VisualizerPayload;
  } catch {
    /* ignore */
  }
  return null;
};

const starterTemplate = (title: string) => `public class Main {
    // ${title}
    public static void main(String[] args) {
        // Write your solution here, then press Visualize
    }
}`;

/**
 * Best-effort lookup of the code a user already wrote for a problem so they
 * never have to re-type it in the visualizer.
 */
export const codeForProblem = (problemKey: string, title: string, userId?: string | null): string => {
  const owners = [userId || 'anon', 'anon'];
  const approaches = ['', '__brute', '__better', '__optimal'];
  for (const owner of owners) {
    for (const suffix of approaches) {
      try {
        const found = localStorage.getItem(`workspace-code-${owner}-${problemKey}${suffix}`);
        if (found && found.trim()) return found;
      } catch {
        /* ignore */
      }
    }
  }
  try {
    const cached = localStorage.getItem(`problem-detail-${problemKey}`);
    if (cached) {
      const detail = JSON.parse(cached);
      const starter = detail?.starterCode || detail?.starter_code || detail?.template;
      if (typeof starter === 'string' && starter.trim()) return starter;
    }
  } catch {
    /* ignore */
  }
  return starterTemplate(title);
};
