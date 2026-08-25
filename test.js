import jwt from "jsonwebtoken";

// const token = await jwt.sign({samose: 4, coldrink: "20 wali campa"}, "mysecretkey", {expiresIn: "1s"});
// console.log(token);



try {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzYW1vc2UiOjQsImNvbGRyaW5rIjoiMjAgd2FsaSBjYW1wYSIsImlhdCI6MTc4NTgxNDA5OCwiZXhwIjoxNzg1ODE0MDk5fQ.uq36fjMHbU6CImD1ZI5l88xS2mXEehtKXKYLDzS5ZbQ";
    const payload = await jwt.verify(token, "mysecretkey")
    console.log(payload);
} catch (error) {
    console.log(error);   

    // JsonWebTokenError
    // JsonWebTokenError
    // TokenExpiredError


}


// email&password => token generate and send as a cookie 
// token