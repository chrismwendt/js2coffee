module.exports = foo:
  bar:
    empty: []
    oneElement: ["one"]
    mixed: [
      1
      2
      3
      "four"
      "five"
    ]
    nestedArray: [
      "1"
      "2"
      [
        "3.1"
        "3.2"
        [
          "3.3.1"
          "3.3.2"
        ]
      ]
      "4"
      "5"
    ]
    nestedMix: [
      {
        k1: 1
        k2: 2
        k3:
          k4a: true
          k4b: [
            "i"
            "ii"
          ]
      }
      "k5"
      {
        k6: 6
        k7: 7
      }
      {
        k8: 8
        k9: 9
      }
      "k10"
    ]