#include <iostream>
#include <vector>
#include <fstream>
#include <string>
using namespace std;

//representing two vertices and the weight of the edge between them
struct Edge{
    string city1;  
    string city2;
    int cost;
};

class ElectricityNetwork{

    private:
        vector <string> cities;     //will store city names
        vector <Edge> edges;        //will store all the connections
        vector <int> parent;

        //function to check if the city entered by user already exists in the vector
        bool CityExists(string city){
            for (int i = 0; i < cities.size(); i++) {
                if (cities[i] == city) {
                    return true;
                }
            }
            return false;
        }

        //initially every city is its own parent
        void set(){
            parent.resize(cities.size());
            for(int i = 0; i < cities.size(); i++){
                parent[i] = i;
            }
        }

        //function to find parent or leader of city
        int parentFind(int city){
            if(parent[city] == city)
                return city;
            //will continue till leader or parent is found 
            return parentFind(parent[city]);
        }

        //check add if cities have diff parent then add in one group
        void unionCities(int city1,int city2){
            int parent1 = parentFind(city1);
            int parent2 = parentFind(city2);
            if(parent1 != parent2){
                parent[parent2] = parent1;
            }
        }

        //function to get index of the city 
        int getIndex(string city){
            for(int i = 0; i < cities.size(); i++){
                if (cities[i] == city)
                    return i;
            }
            return -1;
        }

        //using merge sort to sort all of our edges
        void merge(int left, int mid, int right)
        {
            vector<Edge> temp;
            int i = left;
            int j = mid + 1;

            // compare and merge
            while(i <= mid && j <= right)
            {
                if(edges[i].cost < edges[j].cost)
                {
                    temp.push_back(edges[i]);
                    i++;
                }
                else
                {
                    temp.push_back(edges[j]);
                    j++;
                }
            }
            // remaining left elements
            while(i <= mid)
            {
                temp.push_back(edges[i]);
                i++;
            }
            // remaining right elements
            while(j <= right)
            {
                temp.push_back(edges[j]);
                j++;
            }
            // copy back to original vector
            for(int k = 0; k < temp.size(); k++)
            {
                edges[left + k] = temp[k];
            }
        }
    void mergeSort(int left, int right)
    {
        if(left >= right)
        {
            return;
        }

        int mid = (left + right) / 2;

        mergeSort(left, mid);
        mergeSort(mid + 1, right);
        merge(left, mid, right);
    }

    void sort_edges()
    {
        if(edges.empty()) //if edges contain nothing it returns nothing
        {
            return;
        }
        mergeSort(0, edges.size() - 1);
    }

    public:

        //function to add user defined city 
        void addCity(){
            string city;
            cout << "Enter City name: ";
            cin >> city;

            if (CityExists(city)){
                cout << "City has already been added!\n";
            }  
            else{
                cities.push_back(city); //adds new element to the end of vector     
                cout << "City added Successfully!\n";
            }
        }

        //function to print all cities
        void displayAllCities(){
            if (cities.empty()){
                cout << "No cities have been added!\n";
                return;
            }
            else{
                cout << "\nCities:\n";
                for(int i = 0; i < cities.size(); i++){
                    cout << i+1 <<". " << cities[i] << endl;
               }
            }
        }

        //function to add an edge
        void addConnection(){
            string city1;
            string city2;
            int cost;
            cout << "Enter first city: ";
            cin >> city1;
            cout << "Enter second city: ";
            cin >> city2;
            cout << "Enter connection cost: ";
            cin >> cost;
            if(cost < 0) //handles negative cost entered
            {
                cout << "Cost cannot be negative!\n";
                return;
            }
            if(!CityExists(city1) || !CityExists(city2))
            {
                cout << "One or both cities do not exist.\n";
                return;
            }
            Edge e;
            e.city1 = city1;
            e.city2 = city2;
            e.cost = cost;

            edges.push_back(e);
            cout<<"Connection added successfully!\n";
        } 

        //function to print all connections
        //both cities (vertices) and their electricity wire connection cost (weight)
        void displayConnections(){
            if(edges.empty()){
                cout<<"No connections available!\n";
                return;
            }
            for (int i = 0; i < edges.size(); i++){
                cout << edges[i].city1 << "-----" << edges[i].city2 << " having cost: "
                << edges[i].cost << endl;
            }
        }

        void MST(){
            // first sort by cost
            sort_edges();
            // each city is its own group
            set(); 
            vector<Edge> mst;
            int totalCost = 0;
            for (int i = 0; i < edges.size(); i++){
                int cityA = getIndex(edges[i].city1);
                int cityB = getIndex(edges[i].city2);
                if (cityA == -1 || cityB == -1) //handles case where city is not found in the vector
                {
                    continue;
                }
                int bossA = parentFind(cityA);
                int bossB = parentFind(cityB);
                
                if (bossA != bossB)// check if diff groups then safely add edge (loop handling)
                {
                    mst.push_back(edges[i]);
                    totalCost += edges[i].cost;
                    unionCities(bossA,bossB);
                }
                else //if loop then continue to next edge without adding it to the MST
                {
                    continue;
                }
            }
            for(int i = 0; i < mst.size(); i++) //shows all MST connections and their cost
            {
                cout << mst[i].city1 << "---" << mst[i].city2 << " having cost: " << mst[i].cost << endl;
            }
            cout << "Total MST cost: " << totalCost << endl;
        }

        void saveData()
        {
            ofstream file("network.txt"); //writing to file or creating a file if not existing

            if(!file)
            {
                cout << "File could not open!\n";
                return;
            }

            // save cities count so when reading we know how many cities to read
            file << cities.size() << endl;

            // save city names
            for(int i = 0; i < cities.size(); i++)
            {
                file << cities[i] << endl;
            }

            // save connections count so when reading we know how many connections to read
            file << edges.size() << endl;

            // save all edges
            for(int i = 0; i < edges.size(); i++)
            {
                file << edges[i].city1 << " " << edges[i].city2 << " " << edges[i].cost << endl;
            }

            file.close();

            cout << "Data saved successfully!\n";
        }

        void loadData()
        {
            ifstream file("network.txt"); //reading from file

            if(!file)
            {
                cout << "File not found!\n";
                return;
            }
            
            //old data is cleared before loading new data from file
            cities.clear(); 
            edges.clear();

            int cityCount;
            file >> cityCount; //reads first line

            // load cities and loop runs no. of times as cityCount
            for(int i = 0; i < cityCount; i++)
            {
                string city;
                file >> city;
                cities.push_back(city);
            }

            int edgeCount;
            file >> edgeCount; //takes in no. of edges

            // load edges and loop runs no. of times as edgeCount
            for(int i = 0; i < edgeCount; i++)
            {
                Edge e; //edge struct

                file >> e.city1;
                file >> e.city2;
                file >> e.cost;

                edges.push_back(e);
            }

            file.close();

            cout << "Data loaded successfully!\n";
        }
};

int main(){
    ElectricityNetwork EN;
    int option;
    do{
        cout << "Menu:\n";
        cout << "1. Add City\n";
        cout << "2. Display All Cities\n";
        cout << "3. Add Connection Between Cities\n";
        cout << "4. Display Connections\n";
        cout << "5. MST\n";
        cout << "6. Save Data\n";
        cout << "7. Load Data\n";
        cout << "8. Exit Program\n";
        cout << "Enter Option: ";
        cin >> option;
        switch(option){
            case 1:
                EN.addCity();
                break;
            case 2:
                EN.displayAllCities();
                break;
            case 3:
                EN.addConnection();
                break;
            case 4:
                EN.displayConnections();
                break;
            case 5:
                EN.MST();
                break;
            case 6:
                EN.saveData();
                break;
            case 7:
                EN.loadData();
                break;
            case 8:
                cout<<"Exiting...\n";
                break;
            default:
                cout<<"Invalid Choice!Enter Valid option!\n";
                continue;
        }
    }
    while(option != 8);
    return 0;
}