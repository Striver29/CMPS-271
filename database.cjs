// database.cjs

const professors = [
  { id: 3, name: "Mohamed Zalghout" }
];

const ratings = [
  {
    id: 1,
    professorId: 3,
    course: "CMPS 271",
    rating: 5,
    comment: "Explains software engineering like he wrote the textbook himself."
  },
  {
    id: 2,
    professorId: 3,
    course: "CMPS 271",
    rating: 5,
    comment: "Clear slides, fair exams, and actually cares if students understand."
  },
  {
    id: 3,
    professorId: 3,
    course: "CMPS 271",
    rating: 5,
    comment: "Turned UML from pain into poetry."
  }
];

module.exports = { professors, ratings };
