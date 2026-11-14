export const sampleQuiz = {
  id: 'code-reading-basics',
  title: 'Code reading basics',
  questions: [
    { prompt: 'What is a useful first step when exploring an unfamiliar repository?', options: ['Read its entry points and documentation', 'Delete its tests', 'Run every file as a program'], answer: 0 },
    { prompt: 'What do imports often reveal?', options: ['The screen resolution', 'Dependencies between modules', 'The author’s password'], answer: 1 },
    { prompt: 'Why read tests while studying a function?', options: ['They always replace documentation', 'They modify production code', 'They show expected behavior and edge cases'], answer: 2 }
  ]
};

export function scoreQuiz(answers: number[]): { score: number; total: number } {
  if (!Array.isArray(answers) || answers.length !== sampleQuiz.questions.length ||
    sampleQuiz.questions.some((question, index) => !Number.isInteger(answers[index]) || answers[index] < 0 || answers[index] >= question.options.length)) {
    throw new Error('Answer every question with a valid option.');
  }
  return { score: answers.filter((answer, index) => answer === sampleQuiz.questions[index].answer).length, total: sampleQuiz.questions.length };
}
