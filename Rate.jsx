export default function Rate() {
    const ratings = [
      {
        id: 1,
        professorName: "Mohamed Zalghout",
        course: "CMPS 271",
        rating: 5,
        comment: "Explains software engineering like he wrote the textbook himself."
      },
      {
        id: 2,
        professorName: "Mohamed Zalghout",
        course: "CMPS 271",
        rating: 5,
        comment: "Turned UML from pain into poetry."
      }
    ];
  
    return (
      <div style={{ padding: 20 }}>
        <h1>🔥 Professor Ratings</h1>
  
        {ratings.map(r => (
          <div
            key={r.id}
            style={{
              border: "1px solid black",
              padding: 15,
              marginBottom: 15
            }}
          >
            <h2>{r.professorName}</h2>
            <p>{r.course}</p>
            <p>{r.rating}/5 ⭐⭐⭐⭐⭐</p>
            <p>{r.comment}</p>
          </div>
        ))}
      </div>
    );
  }
  