export interface TopCommunity {
  name: string;
  title: string;
  about: string;
  subscribers: number;
  avatar: string;
}

export const DEFAULT_TOP_COMMUNITIES: TopCommunity[] = [
  {
    name: 'hive-125125',
    title: 'Town Square',
    about: 'The general community for Hive. Share ideas, stories, projects, and meet fellow Hivers.',
    subscribers: 11911,
    avatar: 'https://images.ecency.com/u/hive-125125/avatar/small'
  },
  {
    name: 'hive-193816',
    title: 'Music',
    about: 'Music on the Blockchain. Share original music, reviews, acoustic sets, and production.',
    subscribers: 11351,
    avatar: 'https://images.ecency.com/u/hive-193816/avatar/small'
  },
  {
    name: 'hive-163772',
    title: 'Worldmappin',
    about: 'The Hive travel community. Share travel blogs, pin your photos on the world map!',
    subscribers: 18491,
    avatar: 'https://images.ecency.com/u/hive-163772/avatar/small'
  }
];
