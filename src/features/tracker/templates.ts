import type { Cells } from './formula';
import type { BlockKind } from './blocks';

/**
 * I modelli di «Avanzato → Programmazione»: blocchi già riempiti che si possono cambiare come tutti gli altri.
 * Sono blocchi normali (lista, tabella): niente di nuovo per il server né per la sincronizzazione.
 * I nomi dei problemi restano in inglese, come su LeetCode.
 */
export type TemplateId = 'blind75' | 'streak';
export const TEMPLATE_IDS: TemplateId[] = ['blind75', 'streak'];

export interface TemplateBlock {
  kind: BlockKind;
  config: object;
  data: object;
}

/** I 75 problemi della lista «Blind 75», per tema. */
const BLIND75: [string, string][] = [
  [
    'Array',
    'Two Sum;Best Time to Buy and Sell Stock;Contains Duplicate;Product of Array Except Self;Maximum Subarray;Maximum Product Subarray;Find Minimum in Rotated Sorted Array;Search in Rotated Sorted Array;3Sum;Container With Most Water',
  ],
  ['Binary', 'Sum of Two Integers;Number of 1 Bits;Counting Bits;Missing Number;Reverse Bits'],
  [
    'Dynamic Programming',
    'Climbing Stairs;Coin Change;Longest Increasing Subsequence;Longest Common Subsequence;Word Break;Combination Sum IV;House Robber;House Robber II;Decode Ways;Unique Paths;Jump Game',
  ],
  [
    'Graph',
    'Clone Graph;Course Schedule;Pacific Atlantic Water Flow;Number of Islands;Longest Consecutive Sequence;Alien Dictionary;Graph Valid Tree;Number of Connected Components in an Undirected Graph',
  ],
  [
    'Interval',
    'Insert Interval;Merge Intervals;Non-overlapping Intervals;Meeting Rooms;Meeting Rooms II',
  ],
  [
    'Linked List',
    'Reverse Linked List;Linked List Cycle;Merge Two Sorted Lists;Merge K Sorted Lists;Remove Nth Node From End of List;Reorder List',
  ],
  ['Matrix', 'Set Matrix Zeroes;Spiral Matrix;Rotate Image;Word Search'],
  [
    'String',
    'Longest Substring Without Repeating Characters;Longest Repeating Character Replacement;Minimum Window Substring;Valid Anagram;Group Anagrams;Valid Parentheses;Valid Palindrome;Longest Palindromic Substring;Palindromic Substrings;Encode and Decode Strings',
  ],
  [
    'Tree',
    'Maximum Depth of Binary Tree;Same Tree;Invert Binary Tree;Binary Tree Maximum Path Sum;Binary Tree Level Order Traversal;Serialize and Deserialize Binary Tree;Subtree of Another Tree;Construct Binary Tree from Preorder and Inorder Traversal;Validate Binary Search Tree;Kth Smallest Element in a BST;Lowest Common Ancestor of a BST;Implement Trie (Prefix Tree);Design Add and Search Words Data Structure;Word Search II',
  ],
  ['Heap', 'Top K Frequent Elements;Find Median from Data Stream'],
];

export const BLIND75_PROBLEMS: string[] = BLIND75.flatMap(([topic, list]) =>
  list.split(';').map((name) => `${name} (${topic})`),
);

/** Giorni della sfida «una al giorno». */
export const STREAK_DAYS = 30;
export const STREAK_HEADERS = ['Day', 'Problem', 'Level', 'Min'];

export function templateBlock(id: TemplateId): TemplateBlock {
  if (id === 'blind75') {
    return {
      kind: 'checklist',
      config: {},
      data: {
        items: BLIND75_PROBLEMS.map((text, i) => ({ id: `b${i + 1}`, text, done: false })),
      },
    };
  }
  // una riga per giorno (Day 1…30) e in fondo i totali: quanti giorni hanno i minuti scritti, e quanti minuti in tutto
  const cells: Cells = {};
  for (let d = 1; d <= STREAK_DAYS; d++) cells[`A${d}`] = String(d);
  const last = STREAK_DAYS + 1;
  cells[`A${last}`] = 'Days done';
  cells[`B${last}`] = `=COUNT(D1:D${STREAK_DAYS})`;
  cells[`C${last}`] = 'Minutes';
  cells[`D${last}`] = `=SUM(D1:D${STREAK_DAYS})`;
  return {
    kind: 'table',
    config: { cols: 4, rows: last, headers: STREAK_HEADERS },
    data: { cells },
  };
}
