const hijriDate = document.getElementById("hijriDate");

// 0 = স্বাভাবিক
// 1 = একদিন এগিয়ে
// -1 = একদিন পিছিয়ে
const dateAdjustment = -1;

const arabicMonths = [
    "মুহররম",
    "সফর",
    "রবিউল আউয়াল",
    "রবিউস সানি",
    "জমাদিউল আউয়াল",
    "জমাদিউস সানি",
    "রজব",
    "শাবান",
    "রমজান",
    "শাওয়াল",
    "জিলকদ",
    "জিলহজ"
];

const banglaNumbers = (number) => {
    return number.toString().replace(
        /\d/g,
        digit => "০১২৩৪৫৬৭৮৯"[digit]
    );
};

function showHijriDate() {

    const today = new Date();

    // Adjustment apply
    today.setDate(today.getDate() + dateAdjustment);

    const formatter = new Intl.DateTimeFormat(
        "en-TN-u-ca-islamic",
        {
            day: "numeric",
            month: "numeric",
            year: "numeric"
        }
    );

    const parts = formatter.formatToParts(today);

    const day = Number(
        parts.find(p => p.type === "day").value
    );

    const month = Number(
        parts.find(p => p.type === "month").value
    );

    const year = Number(
        parts.find(p => p.type === "year").value
    );

    hijriDate.textContent =
        `${banglaNumbers(day)} ${arabicMonths[month - 1]} ${banglaNumbers(year)} হিজরি`;
}

showHijriDate();