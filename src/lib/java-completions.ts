/** IntelliJ-style live templates for Java. `body` uses Monaco snippet syntax. */
export interface LiveTemplate { key: string; description: string; body: string }

export const JAVA_LIVE_TEMPLATES: LiveTemplate[] = [
  { key: 'sout', description: 'Prints a string to System.out', body: 'System.out.println($0);' },
  { key: 'souf', description: 'Prints a formatted string', body: 'System.out.printf("$1%n"$0);' },
  { key: 'soutv', description: 'Prints a variable name and value', body: 'System.out.println("${1:value} = " + ${1:value});$0' },
  { key: 'soutm', description: 'Prints current method name', body: 'System.out.println("${1:Main}.${2:method}");$0' },
  { key: 'soutp', description: 'Prints method parameters', body: 'System.out.println("${1:args} = " + ${1:args});$0' },
  { key: 'serr', description: 'Prints a string to System.err', body: 'System.err.println($0);' },
  { key: 'psvm', description: 'main() method declaration', body: 'public static void main(String[] args) {\n\t$0\n}' },
  { key: 'main', description: 'main() method declaration', body: 'public static void main(String[] args) {\n\t$0\n}' },
  { key: 'fori', description: 'Indexed for loop', body: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}' },
  { key: 'forr', description: 'Reverse indexed for loop', body: 'for (int ${1:i} = ${2:n} - 1; ${1:i} >= 0; ${1:i}--) {\n\t$0\n}' },
  { key: 'iter', description: 'Enhanced for loop', body: 'for (${1:int} ${2:item} : ${3:items}) {\n\t$0\n}' },
  { key: 'itar', description: 'Iterate over an array', body: 'for (int ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3:int} ${4:element} = ${2:array}[${1:i}];\n\t$0\n}' },
  { key: 'itli', description: 'Iterate over a List', body: 'for (int ${1:i} = 0; ${1:i} < ${2:list}.size(); ${1:i}++) {\n\t${3:Object} ${4:item} = ${2:list}.get(${1:i});\n\t$0\n}' },
  { key: 'whilet', description: 'while (true) loop', body: 'while (true) {\n\t$0\n}' },
  { key: 'ifn', description: 'if (var == null)', body: 'if (${1:var} == null) {\n\t$0\n}' },
  { key: 'inn', description: 'if (var != null)', body: 'if (${1:var} != null) {\n\t$0\n}' },
  { key: 'thr', description: 'throw new ...', body: 'throw new ${1:RuntimeException}($0);' },
  { key: 'psf', description: 'public static final', body: 'public static final ' },
  { key: 'psfi', description: 'public static final int', body: 'public static final int ${1:NAME} = $0;' },
  { key: 'psfs', description: 'public static final String', body: 'public static final String ${1:NAME} = "$0";' },
  { key: 'prsf', description: 'private static final', body: 'private static final ' },
  { key: 'St', description: 'String', body: 'String ' },
  { key: 'tryc', description: 'try / catch block', body: 'try {\n\t$1\n} catch (${2:Exception} e) {\n\t$0\n}' },
  { key: 'sw', description: 'switch statement', body: 'switch (${1:key}) {\n\tcase ${2:value}:\n\t\t$0\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}' },
  { key: 'lst', description: 'Last element of an array', body: '${1:array}[${1:array}.length - 1]' },
  { key: 'sc', description: 'Scanner reading System.in', body: 'Scanner ${1:sc} = new Scanner(System.in);$0' },
];

export const JAVA_KEYWORDS = [
  'abstract','assert','boolean','break','byte','case','catch','char','class','continue','default','do','double',
  'else','enum','extends','final','finally','float','for','if','implements','import','instanceof','int',
  'interface','long','new','null','package','private','protected','public','return','short','static','super',
  'switch','synchronized','this','throw','throws','try','var','void','while','true','false','record',
];

export const JAVA_CLASSES = [
  'String','StringBuilder','Integer','Long','Double','Character','Boolean','Math','System','Arrays','Collections',
  'List','ArrayList','LinkedList','Map','HashMap','TreeMap','LinkedHashMap','Set','HashSet','TreeSet','Queue',
  'Deque','ArrayDeque','PriorityQueue','Stack','Iterator','Scanner','Optional','Objects','Comparator','Exception',
  'RuntimeException','IllegalArgumentException',
];

export interface CompletionToggles { suggestions: boolean; liveTemplates: boolean }

/** Which completion groups the editor should offer for the given settings. */
export function completionGroups(t: CompletionToggles) {
  return {
    keywords: t.suggestions ? JAVA_KEYWORDS : [],
    classes: t.suggestions ? JAVA_CLASSES : [],
    templates: t.liveTemplates ? JAVA_LIVE_TEMPLATES : [],
  };
}
