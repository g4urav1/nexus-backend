Conversation
\_id
participants: [, ]

messages:
\_id
conversation_id
user_id
created_at

{
\_id: 1
participant: ["raj", "mohan"]

}

{
\_id: 1
participant: ["raj", "suhani"]
}

{
\_id: 1
participant: ["suhani", "mohan"]
}

db.users.insertMany([
{
_id: 1,
name: "Mohan",
email: "mohan@gmail.com",
password: "123",
profile_pic: "http://example.com/img1.png"
},
{
_id: 2,
name: "Rahul",
email: "rahul@gmail.com",
password: "123",
profile_pic: "http://example.com/img2.png"
},
{
_id: 3,
name: "Aman",
email: "aman@gmail.com",
password: "123",
profile_pic: "http://example.com/img3.png"
},
{
_id: 4,
name: "Rohit",
email: "rohit@gmail.com",
password: "123",
profile_pic: "http://example.com/img4.png"
},
{
_id: 5,
name: "Vikas",
email: "vikas@gmail.com",
password: "123",
profile_pic: "http://example.com/img5.png"
},
{
_id: 6,
name: "Arjun",
email: "arjun@gmail.com",
password: "123",
profile_pic: "http://example.com/img6.png"
},
{
_id: 7,
name: "Karan",
email: "karan@gmail.com",
password: "123",
profile_pic: "http://example.com/img7.png"
},
{
_id: 8,
name: "Nikhil",
email: "nikhil@gmail.com",
password: "123",
profile_pic: "http://example.com/img8.png"
},
{
_id: 9,
name: "Aditya",
email: "aditya@gmail.com",
password: "123",
profile_pic: "http://example.com/img9.png"
},
{
_id: 10,
name: "Sahil",
email: "sahil@gmail.com",
password: "123",
profile_pic: "http://example.com/img10.png"
}
])

db.conversations.insertMany([
{
\_id: 1,
participants: [("1"), ("2")]
},
{
\_id: 2,
participants: [("1"), ("3")]
},
{
\_id: 3,
participants: [("2"), ("4")]
},
{
\_id: 4,
participants: [("3"), ("5")]
},
{
\_id: 5,
participants: [("4"), ("6")]
},
{
\_id: 6,
participants: [("5"), ("7")]
},
{
\_id: 7,
participants: [("6"), ("8")]
},
{
\_id: 8,
participants: [("7"), ("9")]
},
{
\_id: 9,
participants: [("8"), ("10")]
},
{
\_id: 10,
participants: [("9"), ("1")]
}
])

```js
db.conversations.aggregate([
  { $match: { participants: "1" } },
  { $lookup: {from: "messages", localField: "_id", foreignField: "conversation_id" , as: "messages"} },
  {$lookup: {from: "users", localField: "participants", foreignField: "_id", as: "participating_users"}}
]);
```





db.conversations.aggregate([
  {
    $match: {
      participants: "1"
    }
  },
  {
    $lookup: {
      from: "messages",
      localField: "_id",
      foreignField: "conversation_id",
      as: "messages"
    }
  },
  {
    $lookup: {
      from: "users",
      let: {
        participantIds: "$participants"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $in: [
                { $toString: "$_id" },
                "$$participantIds"
              ]
            }
          }
        }
      ],
      as: "participating_users"
    }
  }
])