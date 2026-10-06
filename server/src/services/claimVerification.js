const normalize = (s = '') => s.trim().toLowerCase().replace(/\s+/g, ' ');

// questions: [{ id, expected_answer }]   answers: [{ questionId, answer }]
// Returns true only if every private question was answered correctly.
export function verifyClaim(questions, answers) {
  if (!questions.length) return false;
  return questions.every((q) => {
    const given = answers.find((a) => a.questionId === q.id);
    return given && normalize(given.answer) === normalize(q.expected_answer);
  });
}
